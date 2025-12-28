import { openai } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// =============================================================================
// TYPES & SCHEMAS
// =============================================================================

const IntentSchema = z.enum([
  'conversation',
  'question',
  'task',
  'query',
  'command',
  'help',
  'error',
]);

const ActionSchema = z.enum([
  'streamResponse',
  'generateResponse',
  'executeTask',
  'runQuery',
  'showHelp',
  'none',
]);

const TaskTypeSchema = z.enum([
  'creative_writing',
  'analysis',
  'calculation',
  'code_generation',
  'data_processing',
  'general',
]);

const ComplexitySchema = z.enum(['simple', 'moderate', 'complex']);

const SentimentSchema = z.enum(['positive', 'negative', 'neutral']).optional();
const ToneSchema = z
  .enum(['formal', 'casual', 'urgent', 'friendly', 'technical'])
  .optional();

const MetaSchema = z.object({
  intent: IntentSchema,
  reason: z.string(),
  action: ActionSchema,
  confidence: z.number().min(0).max(1),
  sentiment: SentimentSchema,
  tone: ToneSchema,
  taskType: TaskTypeSchema.optional(),
  complexity: ComplexitySchema.optional(),
  estimatedTime: z.number().optional(),
});

const OrchestratorOptionsSchema = z
  .object({
    stream: z.boolean().optional(),
    maxRetries: z.number().min(0).max(5).default(2),
    timeoutMs: z.number().positive().default(30000),
    includeAnalysis: z.boolean().default(true),
    fallbackToConversation: z.boolean().default(true),
  })
  .passthrough(); // Allow additional properties

const OrchestratorOk = z.object({
  status: z.literal('ok'),
  meta: MetaSchema,
  payload: z.object({
    requestId: z.string().uuid(),
    prompt: z.string(),
    options: z.record(z.string(), z.unknown()),
    response: z.any(), // allow stream in runtime; serialize upstream if needed
    processingTimeMs: z.number(),
  }),
});

const OrchestratorErr = z.object({
  status: z.literal('error'),
  meta: MetaSchema, // still return what we had
  payload: z.object({
    requestId: z.string().uuid(),
    prompt: z.string(),
    options: z.record(z.string(), z.unknown()),
    error: z.string(),
    processingTimeMs: z.number(),
  }),
});

const OrchestratorResultSchema = z.union([OrchestratorOk, OrchestratorErr]);

// Exported types
export type Intent = z.infer<typeof IntentSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type TaskType = z.infer<typeof TaskTypeSchema>;
export type Complexity = z.infer<typeof ComplexitySchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type OrchestratorOptions = z.infer<typeof OrchestratorOptionsSchema>;
export type OrchestratorResult = z.infer<typeof OrchestratorResultSchema>;

// Handler registry types
type Ctx = {
  prompt: string;
  meta: Meta;
  options: OrchestratorOptions;
};

type ActionResult =
  | { kind: 'ok'; response: string | AsyncIterable<string> }
  | { kind: 'err'; error: string };

type ActionHandler = (ctx: Ctx) => Promise<ActionResult>;

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_MODEL = openai('gpt-4o-mini');

const CLASSIFICATION_PROMPT = `You are an intent classifier for a conversational AI orchestrator.
Analyze the user prompt and return ONLY a JSON object with these fields:

- intent: one of ${IntentSchema.options.join(', ')}
- reason: brief explanation (max 50 chars)
- action: one of ${ActionSchema.options.join(', ')}
- confidence: number 0-1
- sentiment: optional, one of positive/negative/neutral
- tone: optional, one of formal/casual/urgent/friendly/technical
- taskType: optional, one of ${TaskTypeSchema.options.join(
  ', ',
)} (only for task intent)
- complexity: optional, one of ${ComplexitySchema.options.join(
  ', ',
)} (only for task intent)
- estimatedTime: optional, rough time estimate in seconds (only for task intent)

Guidelines:
- "conversation": general chat, greetings, casual talk → streamResponse
- "question": seeking information → streamResponse
- "task": action requests → executeTask (include taskType, complexity, estimatedTime)
- "query": data/search requests → runQuery
- "command": system commands → executeTask
- "help": assistance requests → showHelp

Task type guidelines:
- "creative_writing": stories, poems, creative content
- "analysis": data analysis, research, evaluation
- "calculation": math, computations, formulas
- "code_generation": programming, scripts, technical solutions
- "data_processing": data manipulation, transformation
- "general": other tasks

User prompt: """{{PROMPT}}"""

Respond with valid JSON only:`;

// =============================================================================
// UTILITIES
// =============================================================================

class OrchestratorError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true,
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new OrchestratorError(
            `Operation timed out after ${timeoutMs}ms`,
            'TIMEOUT',
            true,
          ),
        ),
      timeoutMs,
    );
  });

  return Promise.race([promise, timeout]);
};

const parseJsonSafely = (text: string): unknown => {
  // Clean common LLM output issues
  const cleaned = text
    .replace(/^```json\s*/, '')
    .replace(/\s*```$/, '')
    .replace(/^```\s*/, '')
    .trim();

  return JSON.parse(cleaned);
};

const word = (w: string) => new RegExp(`\\b${w}\\b`, 'i');

const quickClassify = (prompt: string): Meta | null => {
  const p = prompt.trim();

  if (word('help').test(p)) {
    return {
      intent: 'help',
      reason: 'help keyword',
      action: 'showHelp',
      confidence: 0.9,
    };
  }

  if (/[?]\s*$/.test(p) || /^(what|how|why|when|where)\b/i.test(p)) {
    return {
      intent: 'question',
      reason: 'question pattern',
      action: 'streamResponse',
      confidence: 0.8,
    };
  }

  if (
    word('write').test(p) ||
    word('generate').test(p) ||
    word('create').test(p)
  ) {
    const isCode = /(code|function|script|program)\b/i.test(p);
    const isStory = /\b(story|poem|narrative|lyrics?)\b/i.test(p);
    return {
      intent: 'task',
      reason: 'creation keyword',
      action: 'executeTask',
      confidence: 0.85,
      taskType: isCode
        ? 'code_generation'
        : isStory
          ? 'creative_writing'
          : 'general',
      complexity: /\b(short|simple)\b/i.test(p) ? 'simple' : 'moderate',
      estimatedTime: isCode ? 30 : isStory ? 15 : 20,
    };
  }

  return null;
};

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

export const generateResponse = async (
  prompt: string,
  options: { stream?: boolean; timeoutMs?: number } = {},
): Promise<string | AsyncIterable<string>> => {
  const { stream = false, timeoutMs = 30000 } = options;

  if (stream) {
    const result = await streamText({ model: DEFAULT_MODEL, prompt });
    return result.textStream; // return as-is
  } else {
    const { text } = await withTimeout(
      generateText({ model: DEFAULT_MODEL, prompt }),
      timeoutMs,
    );
    return text;
  }
};

const classifyIntentLLM = async (
  prompt: string,
  timeoutMs: number,
): Promise<Meta> => {
  const classificationPrompt = CLASSIFICATION_PROMPT.replace(
    '{{PROMPT}}',
    prompt,
  );

  const { text } = await withTimeout(
    generateText({
      model: DEFAULT_MODEL,
      maxRetries: 1,
      prompt: classificationPrompt,
    }),
    timeoutMs,
  );

  const parsed = parseJsonSafely(text);
  return MetaSchema.parse(parsed);
};

const generateFallbackMeta = (prompt: string, error?: string): Meta => {
  // Simple heuristic-based classification
  const lowerPrompt = prompt.toLowerCase().trim();

  if (
    lowerPrompt.includes('?') ||
    lowerPrompt.startsWith('what') ||
    lowerPrompt.startsWith('how')
  ) {
    return {
      intent: 'question',
      reason: error
        ? `Fallback: question pattern (${error})`
        : 'Fallback: question pattern detected',
      action: 'streamResponse',
      confidence: 0.6,
    };
  }

  if (lowerPrompt.startsWith('help') || lowerPrompt.includes('help')) {
    return {
      intent: 'help',
      reason: error
        ? `Fallback: help request (${error})`
        : 'Fallback: help pattern detected',
      action: 'showHelp',
      confidence: 0.7,
    };
  }

  return {
    intent: 'conversation',
    reason: error
      ? `Fallback: default conversation (${error})`
      : 'Fallback: default conversation',
    action: 'streamResponse',
    confidence: error ? 0.3 : 0.5,
  };
};

// Task handlers
const taskHandlers: Partial<Record<TaskType, ActionHandler>> = {
  code_generation: async ({ prompt, options }) => ({
    kind: 'ok',
    response: await generateResponse(prompt, { timeoutMs: options.timeoutMs }),
  }),
  creative_writing: async ({ prompt, meta, options }) => ({
    kind: 'ok',
    response: await generateResponse(prompt, {
      stream: meta.complexity === 'complex' || /long|novella/i.test(prompt),
      timeoutMs: options.timeoutMs,
    }),
  }),
  analysis: async ({ prompt, options }) => ({
    kind: 'ok',
    response: await generateResponse(prompt, { timeoutMs: options.timeoutMs }),
  }),
  calculation: async ({ prompt, options }) => ({
    kind: 'ok',
    response: await generateResponse(prompt, { timeoutMs: options.timeoutMs }),
  }),
  general: async ({ prompt, options }) => ({
    kind: 'ok',
    response: await generateResponse(prompt, { timeoutMs: options.timeoutMs }),
  }),
};

async function routeTask(ctx: Ctx): Promise<ActionResult> {
  const { meta } = ctx;
  const handler =
    (meta.taskType && taskHandlers[meta.taskType]) || taskHandlers.general;
  if (!handler) return { kind: 'err', error: 'No task handler.' };
  return handler(ctx);
}

// Main handler registry
const handlers: Record<Action, ActionHandler> = {
  streamResponse: async ({ prompt, options }) => ({
    kind: 'ok',
    response: await generateResponse(prompt, {
      stream: true,
      timeoutMs: options.timeoutMs,
    }),
  }),
  generateResponse: async ({ prompt, options }) => ({
    kind: 'ok',
    response: await generateResponse(prompt, {
      stream: false,
      timeoutMs: options.timeoutMs,
    }),
  }),
  showHelp: async () => ({
    kind: 'ok',
    response:
      'I can chat, answer questions, run tasks, or queries. What do you need?',
  }),
  runQuery: async () => ({
    kind: 'ok',
    response: '[runQuery] Not implemented yet.',
  }),
  none: async () => ({
    kind: 'ok',
    response: 'No action required.',
  }),
  executeTask: routeTask,
};

// ===========================================================================
// MAIN ORCHESTRATOR
// ===========================================================================

export const orchestrate = async (
  prompt: string,
  rawOptions: Record<string, unknown> = {},
): Promise<OrchestratorResult> => {
  const t0 = Date.now();
  const requestId = randomUUID();

  const options = OrchestratorOptionsSchema.parse(rawOptions);
  if (!prompt?.trim())
    throw new OrchestratorError(
      'Prompt cannot be empty',
      'EMPTY_PROMPT',
      false,
    );

  // Phase: classify
  let meta: Meta;
  const tClassify0 = Date.now();
  try {
    meta = options.includeAnalysis
      ? (quickClassify(prompt) ??
        (await classifyIntentLLM(prompt, options.timeoutMs)))
      : generateFallbackMeta(prompt);
  } catch (e) {
    meta = options.fallbackToConversation
      ? generateFallbackMeta(prompt, e instanceof Error ? e.message : String(e))
      : (() => {
          throw e;
        })();
  }
  const classifyMs = Date.now() - tClassify0;

  // Phase: execute
  const tExec0 = Date.now();
  let result: ActionResult;
  try {
    const handler = handlers[meta.action] ?? handlers.generateResponse;
    result = await handler({ prompt, meta, options });
  } catch (e) {
    result = {
      kind: 'err',
      error: `Action failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const execMs = Date.now() - tExec0;

  const processingTimeMs = Date.now() - t0;
  // Attach lightweight telemetry (swap with your logger)
  console.debug(
    JSON.stringify({
      requestId,
      classifyMs,
      execMs,
      processingTimeMs,
      action: meta.action,
      taskType: meta.taskType,
    }),
  );

  if (result.kind === 'ok') {
    return {
      status: 'ok',
      meta,
      payload: {
        requestId,
        prompt,
        options: rawOptions,
        response: result.response as any,
        processingTimeMs,
      },
    };
  } else {
    return {
      status: 'error',
      meta,
      payload: {
        requestId,
        prompt,
        options: rawOptions,
        error: result.error,
        processingTimeMs,
      },
    };
  }
};

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export const quickOrchestrate = async (
  prompt: string,
  stream: boolean = false,
): Promise<string> => {
  const result = await orchestrate(prompt, { stream, includeAnalysis: false });
  if (result.status === 'error') {
    throw new Error(result.payload.error);
  }
  return typeof result.payload.response === 'string'
    ? result.payload.response
    : 'No response generated';
};

export const analyzeIntent = async (prompt: string): Promise<Meta> => {
  const result = await orchestrate(prompt, { includeAnalysis: true });
  return result.meta;
};
