import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, render, useStdout, useStdin, useInput } from 'ink';
import type { LogLevel } from './logger.js';

// Types for log entries
interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    data?: Record<string, unknown>;
}

interface WorkflowStep {
    id: string;
    kind: string;
    status: 'running' | 'success' | 'error' | 'pending';
    step: number;
    startTime?: number;
    endTime?: number;
    input?: Record<string, unknown>;
    output?: Record<string, unknown> & {
        stream?: AsyncIterable<string>;
        text?: string;
    };
    error?: string;
    nextEdge?: string;
    duration?: number;
}

interface WorkflowState {
    runId: string;
    steps: WorkflowStep[];
    startTime?: number;
    endTime?: number;
    totalSteps?: number;
    edges: Map<string, { from: string, to: string, label: string }>;
    currentNodeId?: string;
}

// Color theme
const theme = {
    error: '#ff0000',
    warn: '#ffcc00',
    info: '#0099ff',
    debug: '#cc99ff',
    trace: '#888888',
    silent: '#888888', // Added for type safety
    success: '#00cc00',
    running: '#ffcc00', // Added for workflow status
    pending: '#888888', // Added for workflow status
    dim: '#666666',
    bright: '#ffffff',
    streaming: '#00ccff', // Added for streaming outputs

    // Node colors
    Agent: '#ff66cc',
    Tool: '#66ccff',
    Router: '#ffcc00',
    Guard: '#cc99ff',
    MemoryRead: '#99cc00',
    MemoryWrite: '#00cccc',
    End: '#ff9966',

    // Icons (using simple characters for better terminal compatibility)
    icons: {
        Agent: '🤖',
        Tool: '🔧',
        Router: '🚦',
        Guard: '🛡️',
        MemoryRead: '📖',
        MemoryWrite: '📝',
        End: '🏁',

        success: '✓',
        error: '✗',
        running: '⟳',
        pending: '○',
    }
};

// Log Entry Component
const LogEntryComponent: React.FC<{ entry: LogEntry }> = ({ entry }) => {
    const { level, message, timestamp, data } = entry;
    const time = new Date(timestamp).toLocaleTimeString();

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box>
                <Text color="gray">{time}</Text>
                <Text color={theme[level] as string} bold> {level.toUpperCase()} </Text>
                <Text>{message}</Text>
            </Box>
            {data && Object.keys(data).length > 0 && (
                <Box marginLeft={2} flexDirection="column">
                    {Object.entries(data).map(([key, value]) => (
                        <Text key={key} dimColor>
                            {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </Text>
                    ))}
                </Box>
            )}
        </Box>
    );
};

// Node Details Component
const NodeDetails: React.FC<{
    step: WorkflowStep,
    expanded: boolean,
    streamingText?: string,
    isStreaming?: boolean
}> = ({ step, expanded, streamingText = '', isStreaming = false }) => {
    if (!expanded) return null;

    return (
        <Box flexDirection="column" marginLeft={4} marginY={1} borderStyle="single" borderColor={theme.dim} padding={1}>
            {step.duration !== undefined && (
                <Text dimColor>Duration: {step.duration.toFixed(3)}s</Text>
            )}

            {step.input && Object.keys(step.input).length > 0 && (
                <Box flexDirection="column" marginY={1}>
                    <Text bold color={theme.info}>Input:</Text>
                    {Object.entries(step.input).map(([key, value]) => (
                        <Box key={key} marginLeft={2}>
                            <Text color={theme.bright}>{key}: </Text>
                            <Text>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                        </Box>
                    ))}
                </Box>
            )}

            {step.status === 'running' && step.kind === 'Agent' && (
                <LoadingIndicator text={`${step.kind} is thinking...`} />
            )}

            {isStreaming && step.kind === 'Agent' && (
                <StreamingOutput text={streamingText} isActive={isStreaming} />
            )}

            {step.output && Object.keys(step.output).length > 0 && (
                <Box flexDirection="column" marginY={1}>
                    <Text bold color={theme.success}>Output:</Text>
                    {Object.entries(step.output)
                        .filter(([key]) => key !== 'stream') // Don't render stream object
                        .map(([key, value]) => (
                            <Box key={key} marginLeft={2}>
                                <Text color={theme.bright}>{key}: </Text>
                                <Text>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                            </Box>
                        ))}
                </Box>
            )}

            {step.error && (
                <Box flexDirection="column" marginY={1}>
                    <Text bold color={theme.error}>Error:</Text>
                    <Box marginLeft={2}>
                        <Text color={theme.error}>{step.error}</Text>
                    </Box>
                </Box>
            )}

            {step.nextEdge && (
                <Box marginY={1}>
                    <Text color={theme.info} bold>Next: </Text>
                    <Text color={theme.running}>{step.nextEdge}</Text>
                </Box>
            )}
        </Box>
    );
};// Streaming Output Component
const StreamingOutput: React.FC<{ text: string, isActive: boolean }> = ({ text, isActive }) => {
    const [cursor, setCursor] = useState('▋');

    // Blinking cursor effect when active
    useEffect(() => {
        if (!isActive) return;

        const timer = setInterval(() => {
            setCursor(prev => prev === '▋' ? ' ' : '▋');
        }, 500);

        return () => clearInterval(timer);
    }, [isActive]);

    return (
        <Box flexDirection="column" borderStyle="single" borderColor={theme.streaming} padding={1} marginTop={1}>
            <Box marginBottom={1}>
                <Text bold color={theme.streaming}>Streaming Output:</Text>
                {isActive && <Text color={theme.running}> (active)</Text>}
            </Box>
            <Text>
                {text}
                {isActive && <Text color={theme.streaming}>{cursor}</Text>}
            </Text>
        </Box>
    );
};

// Loading Indicator Component
const LoadingIndicator: React.FC<{ text: string }> = ({ text }) => {
    const [frame, setFrame] = useState(0);
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame(prev => (prev + 1) % frames.length);
        }, 80);

        return () => clearInterval(timer);
    }, []);

    return (
        <Box>
            <Text color={theme.running}>{frames[frame]} </Text>
            <Text dimColor>{text}</Text>
        </Box>
    );
};

// Edge Visualization Component
const EdgeVisualizer: React.FC<{ fromId: string, toId: string, label: string }> = ({ fromId, toId, label }) => {
    return (
        <Box marginLeft={4}>
            <Text color={theme.dim}>↳ </Text>
            <Text color={theme.info}>{fromId}</Text>
            <Text color={theme.dim}> → </Text>
            <Text color={theme.running}>{label}</Text>
            <Text color={theme.dim}> → </Text>
            <Text color={theme.info}>{toId}</Text>
        </Box>
    );
};

// Workflow Visualization Component
const WorkflowVisualizer: React.FC<{ workflow: WorkflowState }> = ({ workflow }) => {
    const { runId, steps, startTime, endTime, totalSteps, edges } = workflow;
    const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
    const [streamingText, setStreamingText] = useState<Record<string, string>>({});
    const [isStreaming, setIsStreaming] = useState<Record<string, boolean>>({});

    // Toggle node expansion
    useInput((input, key) => {
        const numKey = parseInt(input);
        if (!isNaN(numKey) && numKey >= 1 && numKey <= steps.length) {
            const step = steps[numKey - 1];
            if (step) {
                setExpandedNodes(prev => ({
                    ...prev,
                    [step.id]: !prev[step.id]
                }));

                // Auto-expand streaming nodes
                if (step.output?.stream && !streamingText[step.id]) {
                    handleStreamStart(step);
                }
            }
        }
    });

    // Handle streaming for Agent nodes that have stream output
    const handleStreamStart = async (step: WorkflowStep) => {
        const stream = step.output?.stream as AsyncIterable<string> | undefined;

        if (!stream) return;

        setIsStreaming(prev => ({ ...prev, [step.id]: true }));

        try {
            for await (const chunk of stream) {
                setStreamingText(prev => ({
                    ...prev,
                    [step.id]: (prev[step.id] || '') + chunk
                }));
            }
        } catch (error) {
            console.error('Streaming error:', error);
        } finally {
            setIsStreaming(prev => ({ ...prev, [step.id]: false }));
        }
    };

    // Auto-expand and start streaming for any new Agent nodes with stream output
    useEffect(() => {
        steps.forEach(step => {
            if (
                step.kind === 'Agent' &&
                step.output?.stream &&
                !streamingText[step.id] &&
                !isStreaming[step.id]
            ) {
                setExpandedNodes(prev => ({ ...prev, [step.id]: true }));
                handleStreamStart(step);
            }
        });
    }, [steps]);

    // Display progress for running nodes
    const [progressFrame, setProgressFrame] = useState(0);
    useEffect(() => {
        const hasRunningNodes = steps.some(s => s.status === 'running');
        if (hasRunningNodes) {
            const timer = setTimeout(() => {
                setProgressFrame((progressFrame + 1) % 4);
            }, 250);
            return () => clearTimeout(timer);
        }
    }, [progressFrame, steps]);

    const progressIndicators = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']; return (
        <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
            <Box justifyContent="space-between">
                <Text bold>Workflow Run: </Text>
                <Text color="cyan">{runId.slice(0, 8)}...</Text>
                <Text dimColor> ({totalSteps || steps.length} steps)</Text>
            </Box>

            <Box flexDirection="column" marginY={1}>
                {steps.map((step, i) => (
                    <React.Fragment key={i}>
                        <Box>
                            <Text>{i === steps.length - 1 ? '└─' : '├─'}</Text>
                            <Text color={theme[step.status] as string}>
                                {step.status === 'running'
                                    ? progressIndicators[progressFrame % progressIndicators.length]
                                    : theme.icons[step.status as keyof typeof theme.icons]
                                }
                            </Text>
                            <Text color={theme[step.kind as keyof typeof theme] as string || 'white'}>
                                {theme.icons[step.kind as keyof typeof theme.icons] || '📦'}
                            </Text>
                            <Text bold>{step.id}</Text>
                            <Text dimColor> ({step.kind})</Text>
                            {step.duration !== undefined && (
                                <Text color={theme.dim}> [{step.duration.toFixed(2)}s]</Text>
                            )}
                            <Text color={expandedNodes[step.id] ? theme.success : theme.dim}>
                                {' '}[{i + 1}]{expandedNodes[step.id] ? '▼' : '▶'}
                            </Text>
                        </Box>

                        <NodeDetails
                            step={step}
                            expanded={!!expandedNodes[step.id]}
                            streamingText={streamingText[step.id]}
                            isStreaming={isStreaming[step.id]}
                        />                        {/* Show edges connecting from this node if expanded */}
                        {expandedNodes[step.id] && Array.from(edges.values())
                            .filter(edge => edge.from === step.id)
                            .map((edge, j) => (
                                <EdgeVisualizer
                                    key={j}
                                    fromId={edge.from}
                                    toId={edge.to}
                                    label={edge.label}
                                />
                            ))
                        }
                    </React.Fragment>
                ))}
            </Box>

            {endTime && startTime && (
                <Box justifyContent="flex-end">
                    <Text dimColor>Completed in {((endTime - startTime) / 1000).toFixed(3)}s</Text>
                </Box>
            )}

            <Box>
                <Text dimColor>Press [number] to expand/collapse node details</Text>
            </Box>
        </Box>
    );
};

// Main Logger App Component
const LoggerApp: React.FC<{
    logs: LogEntry[],
    workflows: Map<string, WorkflowState>,
    maxLogs?: number
}> = ({ logs, workflows, maxLogs = 50 }) => {
    const displayLogs = logs.slice(-maxLogs);
    const activeWorkflows = Array.from(workflows.values());

    return (
        <Box flexDirection="column">
            {activeWorkflows.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    {activeWorkflows.map(workflow => (
                        <WorkflowVisualizer key={workflow.runId} workflow={workflow} />
                    ))}
                </Box>
            )}

            <Box flexDirection="column">
                {displayLogs.map((log, i) => (
                    <LogEntryComponent key={i} entry={log} />
                ))}
            </Box>
        </Box>
    );
};

// Interactive Logger with keyboard controls
const InteractiveLogger: React.FC<{
    logs: LogEntry[],
    workflows: Map<string, WorkflowState>,
    maxLogs?: number
}> = ({ logs, workflows, maxLogs = 50 }) => {
    const [visibleLogs, setVisibleLogs] = useState(maxLogs);
    const [showHelp, setShowHelp] = useState(false);
    const [paused, setPaused] = useState(false);
    const [filter, setFilter] = useState<LogLevel | null>(null);

    useInput((input, key) => {
        if (input === 'q') process.exit(0);
        if (input === 'h') setShowHelp(!showHelp);
        if (input === 'p') setPaused(!paused);
        if (input === 'm') setVisibleLogs(prev => Math.min(prev + 10, logs.length));
        if (input === 'l') setVisibleLogs(prev => Math.max(prev - 10, 10));

        // Filter by log level
        if (input === 'e') setFilter('error');
        if (input === 'w') setFilter('warn');
        if (input === 'i') setFilter('info');
        if (input === 'd') setFilter('debug');
        if (input === 't') setFilter('trace');
        if (input === 'a') setFilter(null); // show all
    });

    const filteredLogs = filter
        ? logs.filter(log => log.level === filter)
        : logs;

    const displayLogs = filteredLogs.slice(-visibleLogs);

    return (
        <Box flexDirection="column">
            <Box borderStyle="single" borderColor="blue" padding={1} marginBottom={1}>
                <Text bold>TQL Graph Logger</Text>
                <Text dimColor> ({displayLogs.length}/{filteredLogs.length} logs)</Text>
                {filter && <Text color={theme[filter] as string}> [Filtered: {filter}]</Text>}
                {paused && <Text color="yellow"> [PAUSED]</Text>}
            </Box>

            {showHelp && (
                <Box flexDirection="column" borderStyle="single" borderColor="yellow" padding={1} marginBottom={1}>
                    <Text bold>Keyboard Controls:</Text>
                    <Text>q: Quit | h: Toggle help | p: Pause/resume</Text>
                    <Text>m: Show more logs | l: Show fewer logs</Text>
                    <Text>e: Filter errors | w: warnings | i: info | d: debug | t: trace | a: all</Text>
                    <Text bold>Node Controls:</Text>
                    <Text>[1-9]: Expand/collapse details for numbered nodes</Text>
                </Box>
            )}

            <LoggerApp
                logs={displayLogs}
                workflows={workflows}
                maxLogs={visibleLogs}
            />
        </Box>
    );
};

// Function to start the Ink logger
export function startInkLogger() {
    const logs: LogEntry[] = [];
    const workflows: Map<string, WorkflowState> = new Map();

    const addLog = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
        logs.push({
            level,
            message,
            timestamp: Date.now(),
            data
        });

        // Process workflow messages
        if (data?.runId && message.includes('.')) {
            updateWorkflowState(message, data);
        }
    };

    const updateWorkflowState = (message: string, data: Record<string, unknown>) => {
        const runId = data.runId as string;

        if (!workflows.has(runId)) {
            workflows.set(runId, {
                runId,
                steps: [],
                edges: new Map()
            });
        }

        const workflow = workflows.get(runId)!;

        if (message === 'run.start') {
            workflow.startTime = Date.now();
        } else if (message === 'run.end') {
            workflow.endTime = Date.now();
            workflow.totalSteps = data.steps as number;
        } else if (message === 'node.start') {
            const nodeId = data.nodeId as string;
            workflow.currentNodeId = nodeId;

            workflow.steps.push({
                id: nodeId,
                kind: data.kind as string,
                status: 'running',
                step: data.step as number,
                startTime: Date.now(),
                input: data.inputPreview as Record<string, unknown>
            });
        } else if (message === 'node.end') {
            const nodeId = data.nodeId as string;
            const stepIndex = workflow.steps.findIndex(s => s.id === nodeId);
            if (stepIndex >= 0) {
                const step = workflow.steps[stepIndex];
                if (step) {
                    const endTime = Date.now();
                    step.endTime = endTime;
                    step.duration = step.startTime ? (endTime - step.startTime) / 1000 : undefined;
                    step.status = data.error ? 'error' : 'success';
                    step.output = data.outputPreview as Record<string, unknown>;
                    step.error = data.error as string;
                    step.nextEdge = data.next as string;
                }
            }
        } else if (message === 'edge.select') {
            // Record edge information
            const edge = {
                from: data.fromId as string,
                to: data.toId as string,
                label: data.requestedLabel as string
            };

            const edgeId = `${edge.from}->${edge.to}`;
            workflow.edges.set(edgeId, edge);
        }
    };

    // Create the Ink app instance
    const app = render(<InteractiveLogger logs={logs} workflows={workflows} />);

    // Return logger API
    return {
        log: (level: LogLevel, message: string, data?: Record<string, unknown>) => {
            addLog(level, message, data);
            app.rerender(<InteractiveLogger logs={logs} workflows={workflows} />);
        },
        error: (msg: string, data?: any) => addLog('error', msg, data),
        warn: (msg: string, data?: any) => addLog('warn', msg, data),
        info: (msg: string, data?: any) => addLog('info', msg, data),
        debug: (msg: string, data?: any) => addLog('debug', msg, data),
        trace: (msg: string, data?: any) => addLog('trace', msg, data),

        // Stop the logger and clean up
        stop: () => {
            app.unmount();
        }
    };
}

// InkLogger class that integrates with existing Logger interface
export class InkLogger {
    private level: LogLevel;
    private inkLogger: ReturnType<typeof startInkLogger> | null = null;
    private workflowState: Map<string, any> = new Map();

    constructor({ level = 'info' }: { level?: LogLevel } = {}) {
        this.level = level;
        this.inkLogger = startInkLogger();
    }

    setLevel(level: LogLevel) {
        this.level = level;
    }

    private enabled(lvl: LogLevel) {
        const ORDER: Record<LogLevel, number> = {
            silent: 99, error: 40, warn: 30, info: 20, debug: 10, trace: 0,
        };
        return ORDER[lvl] >= ORDER[this.level];
    }

    log(level: LogLevel, msg: string, data?: Record<string, unknown>) {
        if (!this.enabled(level)) return;
        if (this.inkLogger) {
            this.inkLogger.log(level, msg, data);
        }
    }

    error(msg: string, data?: any) { this.log('error', msg, data); }
    warn(msg: string, data?: any) { this.log('warn', msg, data); }
    info(msg: string, data?: any) { this.log('info', msg, data); }
    debug(msg: string, data?: any) { this.log('debug', msg, data); }
    trace(msg: string, data?: any) { this.log('trace', msg, data); }
}

// Factory function to create an InkLogger instance
export function createInkLogger(opts: { level?: LogLevel } = {}) {
    return new InkLogger(opts);
}