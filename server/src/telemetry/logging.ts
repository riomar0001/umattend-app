const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
const logsUrl = `${endpoint}/v1/logs`;

const _log = console.log.bind(console);
const _warn = console.warn.bind(console);
const _error = console.error.bind(console);

interface LogBody {
  resourceLogs: Array<{
    resource: {
      attributes: Array<{ key: string; value: { stringValue: string } }>;
    };
    scopeLogs: Array<{
      scope: { name: string };
      logRecords: Array<{
        timeUnixNano: string;
        severityNumber: number;
        severityText: string;
        body: { stringValue: string };
      }>;
    }>;
  }>;
}

function sendLogs(
  scope: string,
  severity: number,
  severityText: string,
  body: string
): void {
  const payload: LogBody = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            {
              key: 'service.name',
              value: {
                stringValue: process.env.OTEL_SERVICE_NAME ?? 'umattend-server',
              },
            },
          ],
        },
        scopeLogs: [
          {
            scope: { name: scope },
            logRecords: [
              {
                timeUnixNano: String(BigInt(Date.now()) * BigInt(1_000_000)),
                severityNumber: severity,
                severityText,
                body: { stringValue: body },
              },
            ],
          },
        ],
      },
    ],
  };

  fetch(logsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

function emitLog(
  level: 'log' | 'warn' | 'error',
  severity: number,
  args: unknown[]
): void {
  const body = args
    .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
    .join(' ');
  sendLogs('console', severity, level.toUpperCase(), body);
}

console.log = (...args: unknown[]) => {
  _log(...args);
  emitLog('log', 9, args);
};
console.warn = (...args: unknown[]) => {
  _warn(...args);
  emitLog('warn', 13, args);
};
console.error = (...args: unknown[]) => {
  _error(...args);
  emitLog('error', 17, args);
};

/** Emit a structured log record to Loki via OTLP — call from middleware or other modules. */
export function logStructured(
  scope: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  attributes: Record<string, string | number>
): void {
  const severity = level === 'error' ? 17 : level === 'warn' ? 13 : 9;
  const extra = Object.entries(attributes)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  sendLogs(scope, severity, level.toUpperCase(), `${message} ${extra}`);
}
