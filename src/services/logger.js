/**
 * PulseGuard — Structured Logger
 *
 * Emits structured JSON log lines to stdout.
 * Each log line includes: level, timestamp, message, and any extra fields.
 *
 * Rules:
 * - NEVER log Slack tokens, API keys, secrets, or OAuth credentials
 * - NEVER log raw installation objects (may contain tokens)
 * - Workspace IDs (e.g. T01234567) are non-sensitive identifiers — OK to log
 * - User IDs (e.g. U01234567) are non-sensitive identifiers — OK to log
 * - Risk data does not contain PII — OK to log selectively
 *
 * Log levels: debug, info, warn, error
 * Set LOG_LEVEL env var to control minimum level (default: 'info')
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL || 'info'] ?? LEVELS.info;

function _log(level, message, fields = {}) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...fields,
  };

  // Use stderr for errors, stdout for everything else
  const output = level === 'error' ? process.stderr : process.stdout;
  output.write(JSON.stringify(entry) + '\n');
}

const logger = {
  debug: (message, fields) => _log('debug', message, fields),
  info:  (message, fields) => _log('info',  message, fields),
  warn:  (message, fields) => _log('warn',  message, fields),
  error: (message, fields) => _log('error', message, fields),

  /**
   * Log a request/response cycle. Safe to call from any route handler.
   */
  request: ({ method, path, workspaceId, statusCode, durationMs }) => _log('info', 'request', {
    method, path, workspaceId, statusCode, durationMs,
  }),
};

module.exports = logger;
