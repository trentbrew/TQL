/**
 * Standard log level indicators for workflow output
 * 
 * These replace emojis to ensure consistent, accessible, and CI-friendly output.
 */
export const LOG_LEVELS = {
  DRY: '[DRY]',
  START: '[START]', 
  RUN: '[RUN]',
  DONE: '[DONE]',
  FAIL: '[FAIL]',
  INFO: '[INFO]',
  LOG: '[LOG]',
} as const;

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS];