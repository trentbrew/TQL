import { openai } from '@ai-sdk/openai';
import { generateText, streamText, generateObject } from 'ai';
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

// Planning schemas for Tree-of-Thought
const PlanSchema = z.object({
  rationale: z.string(),
  steps: z.array(z.string()).min(1),
  assumptions: z.array(z.string()).optional(),
  risks: z.array(z.string()).optional(),
  revisedPrompt: z.string().optional(), // what to actually send to the main model
  toolHints: z.array(z.string()).optional(), // optional routing hints
});

const PlanVoteSchema = z.object({
  winningIndex: z.number().int().min(0),
  reason: z.string(),
});

const OrchestratorOptionsSchema = z
  .object({
    stream: z.boolean().optional(),
    maxRetries: z.number().min(0).max(5).default(2),
    timeoutMs: z.number().positive().default(30000),
    includeAnalysis: z.boolean().default(true),
    fallbackToConversation: z.boolean().default(true),
    // ToT Planner options
    useToT: z.boolean().default(false),
    plannerModel: z.string().default('gpt-4o-mini'), // cheaper model than your main
    numThoughts: z.number().int().min(2).max(8).default(3),
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
    planning: z
      .object({
        winningIndex: z.number(),
        reason: z.string(),
        plan: PlanSchema,
        allPlansCount: z.number(),
      })
      .optional(),
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
    planning: z
      .object({
        winningIndex: z.number(),
        reason: z.string(),
        plan: PlanSchema,
        allPlansCount: z.number(),
      })
      .optional(),
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
export type Plan = z.infer<typeof PlanSchema>;

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
// TREE-OF-THOUGHT PLANNING FUNCTIONS
// =============================================================================

async function proposePlan({
  plannerModel,
  prompt,
}: {
  plannerModel: string;
  prompt: string;
}): Promise<Plan> {
  try {
    const { object } = await generateObject({
      model: openai(plannerModel),
      temperature: 0.7,
      maxRetries: 1,
      prompt: [
        "You are a planning assistant. Produce a concise plan to solve the user's request.",
        'Prefer short, actionable steps. Include a revisedPrompt only if it materially improves the request.',
        'Return a JSON object with: rationale (string), steps (array of strings), assumptions (optional array), risks (optional array), revisedPrompt (optional string).',
        '',
        `User prompt:\n${prompt}`,
      ].join('\n'),
      schema: PlanSchema,
    });
    return object;
  } catch (error) {
    console.warn(
      '[planner] Plan generation failed:',
      error instanceof Error ? error.message : String(error),
    );
    // Return a fallback plan
    return {
      rationale: 'Fallback plan due to generation error',
      steps: ['Analyze the request', 'Provide a comprehensive response'],
      assumptions: [],
      risks: ['Planning failed, using fallback approach'],
    };
  }
}

async function runToT({
  plannerModel,
  prompt,
  numThoughts,
}: {
  plannerModel: string;
  prompt: string;
  numThoughts: number;
}): Promise<{
  plan: Plan;
  allPlans: Plan[];
  winningIndex: number;
  reason: string;
}> {
  try {
    // Generate candidates (parallel)
    const candidates = await Promise.all(
      Array.from({ length: numThoughts }, () =>
        proposePlan({ plannerModel, prompt }),
      ),
    );

    // Ask judge to pick best
    const indexed = candidates
      .map(
        (p, i) =>
          `#${i}\nRationale: ${p.rationale}\nSteps:\n- ${p.steps.join(
            '\n- ',
          )}\n`,
      )
      .join('\n');

    const { object: vote } = await generateObject({
      model: openai(plannerModel),
      temperature: 0.2,
      prompt: [
        'You are a strict judge. Choose the single best plan index for correctness, clarity, and feasibility.',
        'Return only JSON with the winningIndex (number) and reason (string).',
        indexed,
      ].join('\n\n'),
      schema: PlanVoteSchema,
    });

    const winningIndex = Math.max(
      0,
      Math.min(candidates.length - 1, vote.winningIndex),
    );
    const winningPlan = candidates[winningIndex];
    if (!winningPlan) {
      throw new Error('No winning plan found');
    }
    return {
      plan: winningPlan,
      allPlans: candidates,
      winningIndex,
      reason: vote.reason,
    };
  } catch (error) {
    console.warn(
      '[planner] ToT evaluation failed:',
      error instanceof Error ? error.message : String(error),
    );
    // Return the first plan as fallback
    const fallbackPlan = await proposePlan({ plannerModel, prompt });
    return {
      plan: fallbackPlan,
      allPlans: [fallbackPlan],
      winningIndex: 0,
      reason: 'Fallback selection due to evaluation error',
    };
  }
}

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

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

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
      ? quickClassify(prompt) ??
      (await classifyIntentLLM(prompt, options.timeoutMs))
      : generateFallbackMeta(prompt);
  } catch (e) {
    meta = options.fallbackToConversation
      ? generateFallbackMeta(prompt, e instanceof Error ? e.message : String(e))
      : (() => {
        throw e;
      })();
  }
  const classifyMs = Date.now() - tClassify0;

  // Phase: Tree-of-Thought planning (if enabled)
  let effectivePrompt = prompt;
  let planningInfo:
    | undefined
    | {
      winningIndex: number;
      reason: string;
      plan: Plan;
      allPlansCount: number;
    };

  const shouldPlan =
    options.useToT &&
    (meta.intent === 'task' ||
      (meta.intent === 'question' &&
        (meta.complexity === 'complex' ||
          /plan|design|evaluate/i.test(prompt))));

  if (shouldPlan) {
    try {
      const { plan, allPlans, winningIndex, reason } = await runToT({
        plannerModel: options.plannerModel,
        prompt,
        numThoughts: options.numThoughts,
      });

      if (plan.revisedPrompt && plan.revisedPrompt.trim().length > 0) {
        effectivePrompt = plan.revisedPrompt;
      }

      // (Optional) You could stash plan.toolHints somewhere to influence routing/tools.

      planningInfo = {
        winningIndex,
        reason,
        plan,
        allPlansCount: allPlans.length,
      };
    } catch (e) {
      // If planning fails, continue with original prompt
      console.warn(
        '[planner] ToT failed:',
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  // Phase: execute
  const tExec0 = Date.now();
  let result: ActionResult;
  try {
    const handler = handlers[meta.action] ?? handlers.generateResponse;
    result = await handler({ prompt: effectivePrompt, meta, options });
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
        planning: planningInfo,
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
        planning: planningInfo,
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

/**
 * Process a natural language query and convert it to EQL-S
 */
export const processQuery = async (
  query: string,
  context: { catalog: any[]; dataStats: any },
): Promise<{ eqlsQuery?: string; error?: string }> => {
  try {
    // Pre-process the query to handle common patterns
    const processedQuery = handleCommonPatterns(query);

    // Identify entity types from the query (like "fonts", "users", "products")
    const entityType = identifyEntityType(processedQuery);

    // Build strict attribute list and simple aliases from the catalog
    const attributes: string[] = Array.isArray(context.catalog)
      ? context.catalog.map((a: any) => a.attribute).filter(Boolean)
      : [];

    // Helpful alias map for common fields when present
    const aliasPairs: Array<{ alias: string; attr: string }> = [];
    const findAttr = (needle: RegExp) => attributes.find((a) => needle.test(a));
    const questionAttr = findAttr(/question$/i);
    const responseAttr = findAttr(/response$/i);
    const cotAttr = findAttr(/(complex[_\-.]?cot|chain[_\-.]?of[_\-.]?thought)/i);
    if (questionAttr) aliasPairs.push({ alias: 'question', attr: questionAttr });
    if (responseAttr) aliasPairs.push({ alias: 'response', attr: responseAttr });
    if (cotAttr) aliasPairs.push({ alias: 'reasoning', attr: cotAttr });

    const aliasInfo = aliasPairs
      .map(({ alias, attr }) => `- ${alias} ⇒ ${attr}`)
      .join('\n');

    const catalogInfo = context.catalog
      .map(
        (attr) =>
          `- ${attr.attribute}:${attr.type} e.g. ${attr.examples.join(', ')}`,
      )
      .join('\n');

    const prompt = `You are an expert at converting natural language queries to EQL-S (EAV Query Language - Strict).

Available attributes in the dataset:
${catalogInfo}

Attribute aliases you MUST use if the user mentions the alias term:
${aliasInfo || '- (none)'}

Data statistics: ${JSON.stringify(context.dataStats, null, 2)}

EQL-S Grammar Rules:
- Use FIND <type> AS ?var to specify entity type and variable
- Use WHERE clause for conditions
- Use RETURN clause to specify output fields
- Use ORDER BY for sorting, LIMIT for result limits
- Operators: = != > >= < <= BETWEEN ... AND ... CONTAINS MATCHES
- For string pattern matching use MATCHES with regex patterns: MATCHES /pattern/
- For "starts with", use MATCHES /^prefix/
- For "ends with", use MATCHES /suffix$/
- For "contains", use MATCHES /text/ or CONTAINS "text"
- Regex literals must use forward slashes: /pattern/

STRICT formatting rules for this dataset:
- Entity type MUST be "default" unless explicitly specified. Use: FIND default AS ?e
- Only use attribute names EXACTLY as listed above (e.g., ${attributes
      .slice(0, 3)
      .join(', ')} ...). Do not invent attributes.
- NEVER use numeric property access like ?e.0 or ?e.6 — that is invalid.
- If the user refers to "question", "answer/response", or "reasoning/chain of thought",
  use these attributes if available: ${[
        questionAttr,
        responseAttr,
        cotAttr,
      ]
        .filter(Boolean)
        .join(', ') || '(none)'}

Entity type detected: ${entityType || 'item'}
- Avoid using the IN operator for string matching
- Variables must start with ? (e.g., ?p, ?user)
- Strings must be in double quotes
- Regex patterns should be in /pattern/ format but PREFER CONTAINS when possible

Query Pattern Examples (adapt to available attributes):
- "show me [entities] with more than X [numeric_attribute]" → FIND <type> AS ?e WHERE ?e.<attribute> > X RETURN ?e
- "find [entities] containing [text]" → FIND <type> AS ?e WHERE ?e.<text_attribute> CONTAINS "text" RETURN ?e
- "[entities] tagged with [value]" → FIND <type> AS ?e WHERE ?e.<tag_attribute> = "value" RETURN ?e
- "[entities] between X and Y [units]" → FIND <type> AS ?e WHERE ?e.<numeric_attribute> BETWEEN X AND Y RETURN ?e
- "[entities] that start with [prefix]" → FIND <type> AS ?e WHERE ?e.<text_attribute> MATCHES /^prefix/ RETURN ?e.<text_attribute>
- "list [category] [entities]" → FIND <type> AS ?e WHERE ?e.<category_attribute> = "category" RETURN ?e

Convert this natural language query to EQL-S: "${processedQuery}"

Output ONLY the EQL-S query, no explanations or additional text.`;

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      temperature: 0.1,
    });

    let eqlsQuery = result.text.trim();
    
    // Strip markdown code blocks if present
    if (eqlsQuery.startsWith('```') && eqlsQuery.endsWith('```')) {
      // Remove opening and closing ```
      eqlsQuery = eqlsQuery.slice(3, -3).trim();
      
      // Remove language identifier if present (e.g., ```sql, ```eql)
      const firstLine = eqlsQuery.split('\n')[0];
      if (firstLine && !firstLine.includes(' ') && firstLine.length < 20) {
        // This looks like a language identifier, remove it
        eqlsQuery = eqlsQuery.split('\n').slice(1).join('\n').trim();
      }
    }

    // Basic validation - check if it starts with FIND
    if (!eqlsQuery.startsWith('FIND')) {
      return { error: 'Generated query does not start with FIND' };
    }

    // Post-processing hardening
    // 1) Force entity type to 'default' (replace the first token after FIND)
    eqlsQuery = eqlsQuery.replace(/^(FIND)\s+([A-Za-z_][A-Za-z0-9_-]*)\s+AS\s+\?[A-Za-z_][A-Za-z0-9_]*/i, (m, findKw) => {
      // Preserve the variable name if present
      const varMatch = eqlsQuery.match(/AS\s+(\?[A-Za-z_][A-Za-z0-9_]*)/i);
      const v = varMatch ? varMatch[1] : '?e';
      return `${findKw} default AS ${v}`;
    });

    // 2) Disallow numeric property access like ?e.6
    if (/\?[a-zA-Z_]\w*\.\d+/.test(eqlsQuery)) {
      // Try to repair using alias mapping if we can infer intent from the NL query
      const wantsQuestion = /hallucinat|question|prompt/i.test(processedQuery);
      const replacementAttr = wantsQuestion ? questionAttr : responseAttr || questionAttr || attributes[0];
      if (replacementAttr) {
        eqlsQuery = eqlsQuery.replace(/(\?[a-zA-Z_]\w*)\.\d+/g, `$1.${replacementAttr}`);
      } else {
        return { error: 'Generated query used numeric property access (invalid)' };
      }
    }

    // 3) Ensure attribute references exist in catalog (best-effort check)
    // Extract ?var.attr tokens and validate attr
    const attrRefs = Array.from(eqlsQuery.matchAll(/\?[a-zA-Z_]\w*\.([A-Za-z0-9_.-]+)/g))
      .map((m) => m[1])
      .filter((a): a is string => typeof a === 'string');
    const unknown = attrRefs.filter((a: string) => !attributes.includes(a));
    if (unknown.length) {
      // Attempt alias-based repair for common terms inside the query
      let repaired = eqlsQuery;
      for (const unk of unknown) {
        // If the unknown looks like 'question' or 'response', map it
        const lower = unk.toLowerCase();
        const alias = aliasPairs.find(({ alias }) => lower.includes(alias));
        if (alias) {
          repaired = repaired.replace(new RegExp(`(\?[a-zA-Z_]\\w*\.)${unk.replace(/[-/\\.^$*+?()|[\]{}]/g, '\\$&')}`, 'g'), `$1${alias.attr}`);
        }
      }
      if (repaired !== eqlsQuery) {
        eqlsQuery = repaired;
      }
    }

    return { eqlsQuery };
  } catch (error) {
    return {
      error: `Failed to process query: ${error instanceof Error ? error.message : 'Unknown error'
        }`,
    };
  }
};

/**
 * Pre-process natural language queries to handle common patterns
 * This helps ensure more consistent EQL-S generation
 */
/**
 * Identify the entity type from a natural language query
 * Uses common English pluralization patterns to detect entity types
 */
function identifyEntityType(query: string): string | null {
  // Normalize the query for matching
  const normalizedQuery = query.toLowerCase();

  // Look for common patterns that indicate entity types
  // Match words that could be entity types (nouns that are likely data entities)
  const entityPatterns = [
    // Look for "find/show/list [entity_type]" patterns
    /(?:find|show|list|get|search)\s+([a-z]+s?)\b/i,
    // Look for "[entity_type] that/with/containing" patterns  
    /\b([a-z]+s?)\s+(?:that|with|containing|having)\b/i,
    // Look for possessive patterns like "[entity_type]'s [attribute]"
    /\b([a-z]+s?)'?s?\s+[a-z]+/i,
  ];

  for (const pattern of entityPatterns) {
    const match = normalizedQuery.match(pattern);
    if (match && match[1]) {
      let entityType = match[1].toLowerCase();

      // Convert plural to singular using simple rules
      if (entityType.endsWith('ies')) {
        entityType = entityType.slice(0, -3) + 'y';
      } else if (entityType.endsWith('es')) {
        entityType = entityType.slice(0, -2);
      } else if (entityType.endsWith('s') && entityType.length > 3) {
        entityType = entityType.slice(0, -1);
      }

      // Filter out common non-entity words
      const excludeWords = ['this', 'that', 'the', 'and', 'or', 'but', 'with', 'from', 'by', 'at', 'in', 'on', 'to', 'for', 'of', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'all', 'any', 'some', 'more', 'most', 'less', 'least', 'first', 'last', 'next', 'previous'];

      if (!excludeWords.includes(entityType) && entityType.length > 2) {
        return entityType;
      }
    }
  }

  // Default entity type if nothing detected
  return 'item';
}

function handleCommonPatterns(query: string): string {
  // Normalize query for pattern detection while preserving original case for extraction
  let normalizedQuery = query.trim().toLowerCase();

  // Handle "starts with" patterns
  if (normalizedQuery.includes("start with") || normalizedQuery.includes("starts with") ||
    normalizedQuery.includes("beginning with") || normalizedQuery.includes("begins with")) {

    // Look for the letter or prefix mentioned after "starts with"
    const pattern = /(?:starts?|begins?|beginning) with\s+(?:the letter\s+)?['"]?([a-zA-Z0-9]+)['"]?/i;
    const match = query.match(pattern); // Use original query to preserve case

    if (match && match[1]) {
      const prefix = match[1];
      // Rewrite the query to use explicit regex pattern syntax
      normalizedQuery = normalizedQuery.replace(
        /(?:starts?|begins?|beginning) with\s+(?:the letter\s+)?['"]?([a-z0-9]+)['"]?/i,
        `matches /^${prefix}/`
      );
    }
  }

  // Handle "ends with" patterns
  if (normalizedQuery.includes("end with") || normalizedQuery.includes("ends with") ||
    normalizedQuery.includes("ending with")) {

    // Look for the letter or suffix mentioned after "ends with"
    const pattern = /(?:ends?|ending) with\s+(?:the letter\s+)?['"]?([a-zA-Z0-9]+)['"]?/i;
    const match = query.match(pattern); // Use original query to preserve case

    if (match && match[1]) {
      const suffix = match[1];
      // Rewrite the query to use explicit regex pattern syntax
      normalizedQuery = normalizedQuery.replace(
        /(?:ends?|ending) with\s+(?:the letter\s+)?['"]?([a-z0-9]+)['"]?/i,
        `matches /${suffix}$/`
      );
    }
  }

  // Handle "contains" patterns
  if (normalizedQuery.includes("contain") || normalizedQuery.includes("having") ||
    (normalizedQuery.includes("with") && normalizedQuery.includes("in the name"))) {

    // Look for quoted text or specific pattern
    const patterns = [
      /containing\s+(?:the text\s+)?['"]([^'"]+)['"]/i,
      /contains\s+(?:the text\s+)?['"]([^'"]+)['"]/i,
      /with\s+['"]([^'"]+)['"]\s+in the (?:name|title|text)/i,
      /having\s+['"]([^'"]+)['"]\s+in/i
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern); // Use original query to preserve case
      if (match && match[1]) {
        const text = match[1];
        // Rewrite to use explicit regex pattern syntax
        normalizedQuery = normalizedQuery.replace(
          pattern,
          `matches /${text}/`
        );
        break;
      }
    }
  }

  return normalizedQuery;
}
