/**
 * TQL Telemetry - Opt-in usage analytics
 *
 * Collects anonymous usage data to help improve TQL.
 * No PII is collected - only command types, durations, and success/failure.
 */

export interface TelemetryEvent {
  command: string;
  subcommand?: string;
  durationMs: number;
  success: boolean;
  errorType?: string;
  timestamp: number;
  version: string;
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  batchSize?: number;
  flushIntervalMs?: number;
}

class Telemetry {
  private config: TelemetryConfig;
  private events: TelemetryEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: TelemetryConfig = { enabled: false }) {
    this.config = {
      enabled: config.enabled,
      endpoint: config.endpoint || 'https://telemetry.tql.dev/events',
      batchSize: config.batchSize || 10,
      flushIntervalMs: config.flushIntervalMs || 30000, // 30 seconds
    };

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Track a command execution
   */
  track(
    command: string,
    subcommand: string | undefined,
    durationMs: number,
    success: boolean,
    errorType?: string,
  ): void {
    if (!this.config.enabled) return;

    const event: TelemetryEvent = {
      command,
      subcommand,
      durationMs,
      success,
      errorType,
      timestamp: Date.now(),
      version: '1.1.0', // This should match package.json version
    };

    this.events.push(event);

    // Flush if batch size reached
    if (this.events.length >= this.config.batchSize!) {
      this.flush();
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * Flush events to telemetry endpoint
   */
  private async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToSend = [...this.events];
    this.events = [];

    try {
      // In a real implementation, this would send to the telemetry endpoint
      // For now, we'll just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Telemetry events:', eventsToSend);
      }

      // Simulate network request
      await fetch(this.config.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `tql-cli/${eventsToSend[0]?.version || 'unknown'}`,
        },
        body: JSON.stringify({ events: eventsToSend }),
      });
    } catch (error) {
      // Silently fail - telemetry should never break the user experience
      console.debug('Telemetry flush failed:', error);
    }
  }

  /**
   * Shutdown telemetry and flush remaining events
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }
}

// Global telemetry instance
let telemetry: Telemetry | null = null;

/**
 * Initialize telemetry (call once at startup)
 */
export function initTelemetry(config?: TelemetryConfig): void {
  // Check for opt-in environment variable
  const enabled =
    process.env.TQL_TELEMETRY === 'true' || config?.enabled === true;

  if (enabled) {
    telemetry = new Telemetry({ ...config, enabled: true });
    console.log(
      '📊 TQL telemetry enabled. Set TQL_TELEMETRY=false to disable.',
    );
  }
}

/**
 * Track a command execution
 */
export function trackCommand(
  command: string,
  subcommand: string | undefined,
  durationMs: number,
  success: boolean,
  errorType?: string,
): void {
  telemetry?.track(command, subcommand, durationMs, success, errorType);
}

/**
 * Shutdown telemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  await telemetry?.shutdown();
}
