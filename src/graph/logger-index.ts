import { Logger as OriginalLogger } from './logger.js';
import type { LogLevel, LoggerOpts } from './logger.js';
import { InkLogger } from './InkLogger.js';

// Factory function to create the appropriate logger
export function createLogger(opts: LoggerOpts & { useInk?: boolean } = {}) {
    if (opts.useInk) {
        return new InkLogger({ level: opts.level });
    }
    return new OriginalLogger(opts);
}

// Re-export everything from the original logger
export * from './logger.js';
// Export InkLogger
export { InkLogger } from './InkLogger.js';