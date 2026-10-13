import fs from 'node:fs';
const filename = process.argv[2];
if (!filename)
  throw new Error('Usage: node scripts/summarize-performance.mjs tail.ndjson');
const records = [];
function collect(value) {
  if (typeof value === 'string') {
    try {
      collect(JSON.parse(value));
    } catch {}
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (['api_performance', 'web_performance'].includes(value.event)) {
    records.push(value);
    return;
  }
  for (const child of Object.values(value)) collect(child);
}
// Wrangler may emit pretty-printed objects rather than one JSON value per line.
let pending = '';
for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
  if (!pending && !/^\s*(?:\{|\[\s*(?:\{|$))/.test(line)) continue;
  pending += line + '\n';
  try {
    collect(JSON.parse(pending));
    pending = '';
  } catch {}
}
const percentile = (values, p) => {
  const sorted = values.sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
};
const groups = new Map();
for (const record of records) {
  const key =
    record.event === 'api_performance'
      ? record.method + ' ' + record.route + ' [' + record.status + ']'
      : record.route + ' ' + record.name;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(record);
}
for (const [route, items] of groups) {
  const sum = (field) => items.reduce((n, item) => n + (item[field] ?? 0), 0);
  const values = items.map((item) => item.durationMs ?? item.value);
  const api = items[0].event === 'api_performance';
  console.log(
    JSON.stringify({
      route,
      samples: items.length,
      p50: percentile(values, 0.5),
      p95: percentile(values, 0.95),
      ...(api
        ? {
            databaseReadOperations: sum('databaseReadOperations'),
            databaseWriteOperations: sum('databaseWriteOperations'),
            cacheHits: sum('cacheHits'),
            cacheMisses: sum('cacheMisses'),
            cacheErrors: sum('cacheErrors'),
          }
        : {}),
    })
  );
}
if (!records.length)
  console.error(
    'No performance records found. Capture wrangler tail --format json or export structured Workers Logs.'
  );
