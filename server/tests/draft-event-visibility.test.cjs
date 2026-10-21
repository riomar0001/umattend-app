const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../node_modules/typescript');

function repository(isDone) {
  const rows = [
    { id: 'own', created_by: 'creator', is_draft: false, organizers: [] },
    {
      id: 'assigned',
      created_by: 'other',
      is_draft: true,
      organizers: [{ user_id: 'assigned-organizer' }],
    },
    { id: 'private', created_by: 'other', is_draft: true, organizers: [] },
    { id: 'public', created_by: 'other', is_draft: false, organizers: [] },
  ].map((event) => ({ ...event, is_done: isDone, _count: { attendance: 0 } }));
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') return value.some((branch) => matches(row, branch));
      if (key === 'organizers')
        return row.organizers.some(
          (organizer) => organizer.user_id === value.some.user_id
        );
      return row[key] === value;
    });
  }
  const prisma = {
    events: {
      findMany: async ({ where }) => rows.filter((row) => matches(row, where)),
      update: async ({ where, data }) => {
        const row = rows.find((event) => event.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    attendance: { groupBy: async () => [] },
  };
  const imports = {
    '@/utils/customErrors': {},
    '../../configs/prisma.config': { default: prisma },
    '@/generated/prisma/client': {},
    '@/utils/d1': {
      queryInBatches: async (ids, query) => (ids.length ? query(ids) : []),
    },
  };
  const module = { exports: {} };
  const compiled = ts.transpileModule(
    fs.readFileSync(
      path.resolve(__dirname, '../src/v1/repositories/event.repository.ts'),
      'utf8'
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(name in imports, name);
      return imports[name];
    },
  });
  return module.exports.default;
}

for (const [method, isDone] of [
  ['getAllEvents', false],
  ['getAllPastEvents', true],
]) {
  test(`${method}: creator retains event after an admin unposts it, without organizer membership`, async () => {
    const repo = repository(isDone);
    assert.ok(
      (await repo[method](false, 'creator')).some((event) => event.id === 'own')
    );
    await repo.draftEvent('own');
    const result = await repo[method](false, 'creator');
    assert.ok(result.some((event) => event.id === 'own' && event.is_draft));
    assert.ok(
      !result.some((event) => event.id === 'private' || event.id === 'assigned')
    );
  });
  test(`${method}: assigned organizers can see their drafts and unrelated users cannot`, async () => {
    const repo = repository(isDone);
    await repo.draftEvent('own');
    assert.equal(
      (await repo[method](false, 'assigned-organizer'))
        .map((event) => event.id)
        .sort()
        .join(','),
      'assigned,public'
    );
    assert.equal(
      (await repo[method](false, 'unrelated'))
        .map((event) => event.id)
        .join(','),
      'public'
    );
    assert.equal(
      (await repo[method]()).map((event) => event.id).join(','),
      'public'
    );
    assert.equal((await repo[method](true, 'admin')).length, 4);
  });
}
