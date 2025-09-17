export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

const ORDER: Record<LogLevel, number> = {
    silent: 99, error: 40, warn: 30, info: 20, debug: 10, trace: 0,
};

// ANSI Colors and Visual Utilities
export const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',

    // Background colors
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',

    // Extended colors
    gray: '\x1b[90m',
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',
    brightWhite: '\x1b[97m'
};

// ASCII Art and Visual Elements
export const visual = {
    // Workflow shape indicators
    flow: {
        start: '┌─',
        middle: '├─',
        end: '└─',
        vertical: '│',
        horizontal: '─',
        arrow: '→',
        success: '✓',
        error: '✗',
        loading: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
        connecting: ['⠈', '⠐', '⠠', '⢀', '⡀', '⠄', '⠂', '⠁']
    },

    // Node type icons
    icons: {
        Agent: '🤖',
        Tool: '🔧',
        Router: '🚦',
        Guard: '🛡️',
        MemoryRead: '📖',
        MemoryWrite: '📝',
        End: '🏁'
    },

    // Box drawing for workflow visualization
    boxes: {
        topLeft: '┌',
        topRight: '┐',
        bottomLeft: '└',
        bottomRight: '┘',
        horizontal: '─',
        vertical: '│',
        cross: '┼',
        teeDown: '┬',
        teeUp: '┴',
        teeRight: '├',
        teeLeft: '┤'
    }
};

// Animation utilities
export class AnimationFrames {
    private frame = 0;
    private interval?: NodeJS.Timeout;

    start(callback: (frame: string) => void, frames: string[], speed = 100) {
        this.stop();
        this.interval = setInterval(() => {
            const frame = frames[this.frame % frames.length];
            if (frame) callback(frame);
            this.frame++;
        }, speed);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
        }
    }
}

// Syntax highlighting for JSON
export function highlightJSON(obj: any): string {
    const json = JSON.stringify(obj, null, 2);
    return json
        .replace(/"([^"]+)":/g, `${colors.brightCyan}"$1"${colors.reset}:`)
        .replace(/: "([^"]+)"/g, `: ${colors.brightGreen}"$1"${colors.reset}`)
        .replace(/: (\d+)/g, `: ${colors.brightYellow}$1${colors.reset}`)
        .replace(/: (true|false)/g, `: ${colors.brightMagenta}$1${colors.reset}`)
        .replace(/: null/g, `: ${colors.dim}null${colors.reset}`);
}

// Create visual workflow representation
export function renderWorkflowStep(
    step: number,
    nodeId: string,
    nodeKind: string,
    status: 'running' | 'success' | 'error' | 'pending' = 'pending',
    isLast = false
): string {
    const icon = visual.icons[nodeKind as keyof typeof visual.icons] || '📦';
    const connector = isLast ? visual.flow.end : visual.flow.middle;

    let statusIcon = '';
    let nodeColor = colors.white;

    switch (status) {
        case 'running':
            statusIcon = `${colors.brightYellow}${visual.flow.loading[0]}${colors.reset}`;
            nodeColor = colors.brightYellow;
            break;
        case 'success':
            statusIcon = `${colors.brightGreen}${visual.flow.success}${colors.reset}`;
            nodeColor = colors.brightGreen;
            break;
        case 'error':
            statusIcon = `${colors.brightRed}${visual.flow.error}${colors.reset}`;
            nodeColor = colors.brightRed;
            break;
        default:
            statusIcon = `${colors.gray}○${colors.reset}`;
            nodeColor = colors.gray;
    }

    const stepNum = `${colors.dim}${step.toString().padStart(2, '0')}${colors.reset}`;
    const nodeName = `${nodeColor}${nodeId}${colors.reset}`;
    const kindBadge = `${colors.dim}(${nodeKind})${colors.reset}`;

    return `${colors.gray}${connector}${colors.reset} ${stepNum} ${statusIcon} ${icon} ${nodeName} ${kindBadge}`;
}

export interface LoggerOpts {
    level?: LogLevel;
    json?: boolean;                           // JSONL logs (great for piping)
    visual?: boolean;                         // Enable beautiful visual formatting
    sink?: (line: string) => void;            // override default console.log
}

export class Logger {
    private level: LogLevel;
    private json: boolean;
    private visual: boolean;
    private sink: (line: string) => void;
    private workflowState: Map<string, { step: number, nodes: Array<{ id: string, kind: string, status: 'running' | 'success' | 'error' | 'pending' }> }> = new Map();

    constructor({ level = 'info', json = false, visual = true, sink }: LoggerOpts = {}) {
        this.level = level;
        this.json = json;
        this.visual = visual && !json; // Disable visual if JSON mode
        this.sink = sink ?? ((l) => console.log(l));
    }

    setLevel(level: LogLevel) { this.level = level; }

    private enabled(lvl: LogLevel) { return ORDER[lvl] >= ORDER[this.level]; }

    // Enhanced visual logging
    log(level: LogLevel, msg: string, data?: Record<string, unknown>) {
        if (!this.enabled(level)) return;

        if (this.json) {
            this.sink(JSON.stringify({ ts: Date.now(), level, msg, ...safe(data) }));
            return;
        }

        // Visual formatting based on message type
        if (this.visual) {
            const formatted = this.formatVisualMessage(level, msg, data);
            this.sink(formatted);
        } else {
            const tail = data ? ` ${JSON.stringify(safe(data))}` : '';
            this.sink(`[${new Date().toISOString()}] ${level.toUpperCase()} ${msg}${tail}`);
        }
    }

    private formatVisualMessage(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
        const timestamp = `${colors.dim}${new Date().toLocaleTimeString()}${colors.reset}`;
        const runId = data?.runId as string;

        // Handle workflow-specific messages
        if (runId && msg.includes('.')) {
            return this.formatWorkflowMessage(level, msg, data);
        }

        // Standard log formatting with colors
        const levelColors: Record<LogLevel, string> = {
            silent: colors.gray,
            error: colors.brightRed,
            warn: colors.brightYellow,
            info: colors.brightBlue,
            debug: colors.cyan,
            trace: colors.gray
        };

        const levelColor = levelColors[level] || colors.white;
        const levelBadge = `${levelColor}${level.toUpperCase().padEnd(5)}${colors.reset}`;

        let formattedData = '';
        if (data && Object.keys(data).length > 0) {
            formattedData = `\n${colors.dim}${highlightJSON(data)}${colors.reset}`;
        }

        return `${timestamp} ${levelBadge} ${msg}${formattedData}`;
    }

    private formatWorkflowMessage(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
        const runId = data?.runId as string;
        const nodeId = data?.nodeId as string;
        const step = data?.step as number;
        const kind = data?.kind as string;

        // Initialize workflow state if needed
        if (!this.workflowState.has(runId)) {
            this.workflowState.set(runId, { step: 0, nodes: [] });
        }

        const workflow = this.workflowState.get(runId)!;

        // Handle different message types
        if (msg === 'run.start') {
            return this.formatRunStart(data);
        } else if (msg === 'run.end') {
            return this.formatRunEnd(data);
        } else if (msg === 'node.start') {
            return this.formatNodeStart(workflow, nodeId, kind, step);
        } else if (msg === 'node.end') {
            return this.formatNodeEnd(workflow, nodeId, data);
        } else if (msg === 'edge.select') {
            return this.formatEdgeSelect(data);
        } else if (msg === 'router.eval') {
            const label = data?.label as string;
            const ok = data?.ok as boolean;
            const verdict = ok ? `${colors.brightGreen}yes${colors.reset}` : `${colors.brightRed}no${colors.reset}`;
            return `      ${colors.gray}🔍${colors.reset} ${colors.dim}route "${label}": ${verdict}${colors.reset}`;
        } else if (msg === 'router.choice') {
            const next = (data?.next as string) || 'default';
            return `      ${colors.yellow}🚦${colors.reset} ${colors.dim}next: "${next}"${colors.reset}`;
        } else if (msg === 'guard.decision') {
            const allow = data?.allow as boolean;
            const verdict = allow ? `${colors.brightGreen}allow${colors.reset}` : `${colors.brightRed}block${colors.reset}`;
            return `      ${colors.gray}🛡️${colors.reset} ${colors.dim}${verdict}${colors.reset}`;
        } else if (msg === 'memory.read') {
            const key = data?.key as string;
            const bytes = data?.bytes as number | undefined;
            const size = bytes !== undefined ? ` ${colors.dim}(${bytes}b)${colors.reset}` : '';
            return `      ${colors.cyan}📖${colors.reset} ${colors.dim}read ${key}${colors.reset}${size}`;
        } else if (msg === 'memory.write') {
            const key = data?.key as string;
            const from = data?.from as string | undefined;
            const bytes = data?.bytes as number | undefined;
            const meta = [from ? `from ${from}` : null, bytes !== undefined ? `(${bytes}b)` : null].filter(Boolean).join(' ');
            return `      ${colors.cyan}📝${colors.reset} ${colors.dim}write ${key}${meta ? ' ' + colors.dim + meta + colors.reset : ''}`;
        } else if (msg.includes('tool.') || msg.includes('agent.')) {
            return this.formatExecutorMessage(level, msg, data);
        }

        // Fallback to standard formatting
        return this.formatNonWorkflowMessage(level, msg, data);
    }

    // Non-workflow generic formatter to avoid recursion when called from formatWorkflowMessage
    private formatNonWorkflowMessage(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
        const levelColors: Record<LogLevel, string> = {
            silent: colors.gray,
            error: colors.brightRed,
            warn: colors.brightYellow,
            info: colors.brightBlue,
            debug: colors.cyan,
            trace: colors.gray
        };
        const levelColor = levelColors[level] || colors.white;
        const levelBadge = `${levelColor}${level.toUpperCase().padEnd(5)}${colors.reset}`;
        let formattedData = '';
        if (data && Object.keys(data).length > 0) {
            formattedData = `\n${colors.dim}${highlightJSON(data)}${colors.reset}`;
        }
        return `${levelBadge} ${msg}${formattedData}`;
    }

    private formatRunStart(data?: Record<string, unknown>): string {
        const runId = (data?.runId as string)?.slice(0, 8) || 'unknown';
        const startId = data?.startId as string;

        return `\n${colors.brightCyan}╭─────────────────────────────────────────────────────────────${colors.reset}\n` +
            `${colors.brightCyan}│${colors.reset} ${colors.bright}🚀 Workflow Execution Started${colors.reset}\n` +
            `${colors.brightCyan}│${colors.reset} ${colors.dim}Run ID: ${runId}...${colors.reset}\n` +
            `${colors.brightCyan}│${colors.reset} ${colors.dim}Entry Point: ${startId}${colors.reset}\n` +
            `${colors.brightCyan}╰─────────────────────────────────────────────────────────────${colors.reset}\n`;
    }

    private formatRunEnd(data?: Record<string, unknown>): string {
        const steps = data?.steps as number;
        const traces = data?.traces as number;

        return `\n${colors.brightGreen}╭─────────────────────────────────────────────────────────────${colors.reset}\n` +
            `${colors.brightGreen}│${colors.reset} ${colors.bright}🏁 Workflow Execution Completed${colors.reset}\n` +
            `${colors.brightGreen}│${colors.reset} ${colors.dim}Total Steps: ${steps}${colors.reset}\n` +
            `${colors.brightGreen}│${colors.reset} ${colors.dim}Trace Count: ${traces}${colors.reset}\n` +
            `${colors.brightGreen}╰─────────────────────────────────────────────────────────────${colors.reset}\n`;
    }

    private formatNodeStart(workflow: any, nodeId: string, kind: string, step: number): string {
        const stepNum = `${colors.dim}${step.toString().padStart(2, '0')}${colors.reset}`;
        const icon = visual.icons[kind as keyof typeof visual.icons] || '📦';
        const spinner = `${colors.brightYellow}⠋${colors.reset}`;

        return `${colors.gray}├─${colors.reset} ${stepNum} ${spinner} ${icon} ${colors.brightYellow}${nodeId}${colors.reset} ${colors.dim}(${kind})${colors.reset}`;
    }

    private formatNodeEnd(workflow: any, nodeId: string, data?: Record<string, unknown>): string {
        const ms = data?.ms as number;
        const next = data?.next as string;
        const error = data?.error as string;
        const outputBytes = data?.outputBytes as number;

        const timing = ms !== undefined ? `${colors.dim}${ms}ms${colors.reset}` : '';
        const size = outputBytes !== undefined ? `${colors.dim}${outputBytes}b${colors.reset}` : '';
        const status = error ? `${colors.brightRed}✗${colors.reset}` : `${colors.brightGreen}✓${colors.reset}`;
        const nextLabel = next ? `${colors.dim}→ ${next}${colors.reset}` : `${colors.dim}→ end${colors.reset}`;

        return `    ${status} ${timing} ${size} ${nextLabel}`;
    }

    private formatEdgeSelect(data?: Record<string, unknown>): string {
        const from = data?.from as string;
        const label = data?.requestedLabel as string;
        const picked = data?.picked as string;

        if (picked) {
            return `    ${colors.gray}${visual.flow.arrow}${colors.reset} ${colors.dim}routing via "${label}"${colors.reset}`;
        } else {
            return `    ${colors.brightRed}⚠${colors.reset} ${colors.dim}no route found for "${label}"${colors.reset}`;
        }
    }

    private formatExecutorMessage(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
        const nodeId = data?.nodeId as string;
        const indent = '      ';

        if (msg.includes('tool.invoke')) {
            const name = data?.name as string;
            return `${indent}${colors.cyan}🔧${colors.reset} ${colors.dim}executing ${name}${colors.reset}`;
        } else if (msg.includes('tool.result')) {
            const bytes = data?.bytes as number;
            const preview = data?.preview as string;
            const size = bytes ? `${colors.dim}(${bytes}b)${colors.reset}` : '';
            return `${indent}${colors.brightGreen}📤${colors.reset} ${colors.dim}result ready${colors.reset} ${size}`;
        } else if (msg.includes('agent.request')) {
            const model = data?.model as string;
            return `${indent}${colors.magenta}🤖${colors.reset} ${colors.dim}prompting ${model}${colors.reset}`;
        } else if (msg.includes('agent.response')) {
            const bytes = data?.bytes as number;
            const size = bytes ? `${colors.dim}(${bytes}b)${colors.reset}` : '';
            return `${indent}${colors.brightGreen}💬${colors.reset} ${colors.dim}response received${colors.reset} ${size}`;
        }

        return `${indent}${colors.dim}${msg}${colors.reset}`;
    }

    error(msg: string, data?: any) { this.log('error', msg, data); }
    warn(msg: string, data?: any) { this.log('warn', msg, data); }
    info(msg: string, data?: any) { this.log('info', msg, data); }
    debug(msg: string, data?: any) { this.log('debug', msg, data); }
    trace(msg: string, data?: any) { this.log('trace', msg, data); }
}

export function preview(v: unknown, max = 160) {
    try {
        const s = typeof v === 'string' ? v : JSON.stringify(v);
        return s.length > max ? s.slice(0, max) + '…' : s;
    } catch { return String(v); }
}

export function sizeof(v: unknown) {
    try { return Buffer.byteLength(typeof v === 'string' ? v : JSON.stringify(v)); }
    catch { return -1; }
}

function safe(data: any) {
    // avoid blowing up logs on huge objects; trim large fields
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data ?? {})) {
        const b = sizeof(v);
        out[k] = b > 64_000 ? { _type: typeof v, bytes: b, preview: preview(v) } : v;
    }
    return out;
}