const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../node_modules/typescript');
function load(file, imports, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(name in imports, name);
      return imports[name];
    },
    console,
    Date,
    crypto: require('node:crypto').webcrypto,
    ...globals,
  });
  return module.exports;
}
function setup() {
  const data = new Map();
  const storage = {
    async get(key) {
      return data.get(key);
    },
    async put(key, value) {
      data.set(key, value);
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) data.delete(key);
    },
    async list({ prefix }) {
      return new Map([...data].filter(([key]) => key.startsWith(prefix)));
    },
    async transaction(fn) {
      return fn(storage);
    },
  };
  const { EphemeralStore } = load('worker/ephemeralStore.do.ts', {
    'cloudflare:workers': {
      DurableObject: class {
        constructor(ctx) {
          this.ctx = ctx;
        }
      },
    },
  });
  const store = new EphemeralStore({ storage });
  const outcomes = [];
  const config = { env: {} };
  const cache = load(
    'utils/dataCache.ts',
    {
      '../worker/runtime': {
        bindings: () => ({
          EPHEMERAL_STORE: { idFromName: (name) => name, get: () => store },
        }),
      },
      './performance': { countCache: (outcome) => outcomes.push(outcome) },
    },
    { process: config }
  );
  return { store, cache, data, outcomes, config };
}
test('warm summaries avoid loading and writes invalidate every cached key', async () => {
  const { cache, outcomes } = setup();
  let calls = 0;
  const get = () =>
    cache.cachedData('stats', 30, async () => ({ count: ++calls }));
  assert.equal((await get()).count, 1);
  assert.equal((await get()).count, 1);
  await cache.invalidateDataCache();
  assert.equal((await get()).count, 2);
  assert.deepEqual(outcomes, ['miss', 'hit', 'miss']);
});
test('in-flight pre-mutation reads cannot restore stale summaries', async () => {
  const { store } = setup();
  const snapshot = await store.getSummary('stats');
  await store.invalidateSummaries();
  await store.putSummary('stats', snapshot.generation, '{"count":1}', 30);
  assert.equal((await store.getSummary('stats')).value, null);
});
test('expired and failed results are not served from cache', async () => {
  const { store, cache } = setup();
  const snapshot = await store.getSummary('expired');
  await store.putSummary('expired', snapshot.generation, '1', -1);
  assert.equal((await store.getSummary('expired')).value, null);
  await assert.rejects(
    cache.cachedData('failed', 30, async () => {
      throw new Error('db');
    }),
    /db/
  );
  assert.equal((await store.getSummary('failed')).value, null);
});
test('cache outages fall back to database reads', async () => {
  const { store, cache, outcomes } = setup();
  store.getSummary = async () => {
    throw new Error('unavailable');
  };
  assert.equal(await cache.cachedData('stats', 30, async () => 42), 42);
  assert.deepEqual(outcomes, ['error']);
});
test('cache storage is bounded and bypass switch loads every time', async () => {
  const { store, cache, data, config } = setup();
  for (let i = 0; i < 140; i++) {
    const { generation } = await store.getSummary('key:' + i);
    await store.putSummary('key:' + i, generation, '1', 30);
  }
  assert.equal(
    [...data.keys()].filter((key) => key.startsWith('summary:')).length,
    128
  );
  config.env.DATA_CACHE_ENABLED = 'false';
  let calls = 0;
  await cache.cachedData('stats', 30, async () => ++calls);
  await cache.cachedData('stats', 30, async () => ++calls);
  assert.equal(calls, 2);
});
