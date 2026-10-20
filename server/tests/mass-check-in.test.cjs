const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../node_modules/typescript');

function load(file, imports = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, file), 'utf8'),
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
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    },
    Error,
    console,
  });
  return module.exports;
}
const errors = load('../src/utils/customErrors.ts');
const { validateStudentIds, runMassCheckIn } = load(
  '../src/v1/services/mass-check-in.ts',
  { '../../utils/customErrors': errors }
);
const { parseMassCheckIn } = load('../../client/src/lib/mass-check-in.ts');

const checkInCalls = [];
const controller = load('../src/v1/controllers/event.controller.ts', {
  exceljs: {},
  '@/utils/responseHandler': load('../src/utils/responseHandler.ts'),
  'express-validator': {},
  '../services/event.service': {
    default: {
      checkInStudentById: async (...args) => {
        checkInCalls.push(args);
      },
    },
  },
  '@/utils/customErrors': errors,
  '@/utils/export.utils': {},
  '@/constants/app.constants': {},
  '@/utils/decodeAndVerifyQR': {},
  '@/utils/routeParams': { routeParam: (req, name) => req.params[name] },
  '../services/mass-check-in': { validateStudentIds, runMassCheckIn },
}).default;

async function request(studentIds, onboarded = true) {
  const res = {
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await controller.massCheckInEvent(
    {
      params: { event_id: 'event' },
      body: { student_ids: studentIds },
      user: { id: 'organizer', done_onboarding: onboarded },
    },
    res
  );
  return res;
}

test('controller validates the entire batch and onboarding before any check-ins', async () => {
  checkInCalls.length = 0;
  assert.equal((await request(['123456', 'bad'])).code, 400);
  assert.equal((await request(['123456'], false)).code, 403);
  assert.equal(checkInCalls.length, 0);
});

test('controller passes event and organizer identity and returns per-student results', async () => {
  checkInCalls.length = 0;
  const res = await request(['123456', '123456', '234567']);
  assert.equal(res.code, 200);
  assert.deepEqual(checkInCalls, [
    ['event', 123456, 'organizer'],
    ['event', 234567, 'organizer'],
  ]);
  assert.equal(res.body.data.results.length, 2);
});

test('rejects malformed or oversized payloads before processing; deduplicates strings', () => {
  for (const value of [
    null,
    {},
    [],
    [123456],
    ['123456junk'],
    ['12345'],
    ['1234567'],
    Array(26).fill('123456'),
  ]) {
    assert.throws(() => validateStudentIds(value), errors.BadRequestError);
  }
  assert.equal(
    JSON.stringify(validateStudentIds(['012345', '123456', '012345'])),
    JSON.stringify(['012345', '123456'])
  );
});

test('processes partial success sequentially, skips duplicates, and hides internal errors', async () => {
  const calls = [];
  const response = await runMassCheckIn(
    ['123456', '234567', '345678', '456789', '567890'],
    async (id) => {
      calls.push(id);
      if (id === 234567) throw new errors.ConflictError('Already checked in');
      if (id === 345678) throw new errors.ForbiddenError('Wrong department');
      if (id === 456789) throw new errors.BadRequestError('Event is full');
      if (id === 567890) throw new Error('secret database details');
    }
  );
  assert.deepEqual(calls, [123456, 234567, 345678, 456789, 567890]);
  assert.equal(
    response.results.map((r) => r.status).join(','),
    'checked_in,skipped,failed,failed,failed'
  );
  assert.equal(response.results[2].message, 'Wrong department');
  assert.equal(response.results[3].message, 'Event is full');
  assert.ok(!response.results[4].message.includes('secret'));
});

test('manual IDs retain leading zeroes, deduplicate, and flag malformed tokens', () => {
  const parsed = parseMassCheckIn('012345, 123456\n123456;234567 bad 12345');
  assert.equal(parsed.ids.join(','), '012345,123456,234567');
  assert.equal(parsed.duplicates, 1);
  assert.equal(parsed.invalid.join(','), 'bad,12345');
});

test('CSV supports BOM, CRLF, reordered headers, escaped quotes and embedded newlines', () => {
  const parsed = parseMassCheckIn(
    '\uFEFFName,Student ID,Email\r\n"Doe, Jane",012345,jane@example.test\r\n"John ""J""\nSmith",123456,john@example.test',
    true
  );
  assert.equal(parsed.ids.join(','), '012345,123456');
  assert.equal(parsed.invalid.length, 0);
  assert.equal(
    parseMassCheckIn('"123456"\n234567\n', true).ids.join(','),
    '123456,234567'
  );
});

test('CSV rejects ambiguous columns and malformed quoting, and flags missing IDs', () => {
  assert.throws(
    () => parseMassCheckIn('Name,Email\nJane,jane@example.test', true),
    /student_id/
  );
  assert.throws(() => parseMassCheckIn('"123456', true), /Unclosed/);
  assert.throws(() => parseMassCheckIn('"123456"junk', true), /Invalid/);
  assert.equal(
    parseMassCheckIn('student_id,name\n,Jane\n12345,John', true).invalid.length,
    2
  );
});

test('limits large imports', () => {
  assert.throws(
    () =>
      parseMassCheckIn(
        Array.from({ length: 1001 }, (_, i) => String(100000 + i)).join('\n')
      ),
    /1?000|1000/
  );
});

function repository({
  student = { department: 'D' },
  existing = null,
  counts = [0, 1],
  createError,
} = {}) {
  let creates = 0;
  let deletes = 0;
  class KnownError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }
  const prisma = {
    events: { findUnique: async () => ({ department: 'D', capacity: 1 }) },
    student: { findUnique: async () => student },
    attendance: {
      findUnique: async () => existing,
      count: async () => counts.shift(),
      create: async () => {
        creates++;
        if (createError) throw new KnownError(createError);
        return { id: 'attendance', created_at: new Date() };
      },
      delete: async () => {
        deletes++;
      },
    },
  };
  const repo = load('../src/v1/repositories/event.repository.ts', {
    '@/utils/customErrors': errors,
    '../../configs/prisma.config': { default: prisma },
    '@/generated/prisma/client': {
      Prisma: { PrismaClientKnownRequestError: KnownError },
    },
    '@/utils/d1': {},
  }).default;
  return {
    checkIn: () => repo.checkInStudentById('event', 123456, 'organizer'),
    creates: () => creates,
    deletes: () => deletes,
  };
}

test('manual check-in rejects unknown or ineligible students without inserting', async () => {
  const unknown = repository({ student: null });
  await assert.rejects(unknown.checkIn, errors.NotFoundError);
  assert.equal(unknown.creates(), 0);
  const ineligible = repository({ student: { department: 'Other' } });
  await assert.rejects(ineligible.checkIn, errors.ForbiddenError);
  assert.equal(ineligible.creates(), 0);
});

test('already checked-in students are skipped even when the event is full', async () => {
  const repo = repository({ existing: { id: 'existing' }, counts: [1] });
  await assert.rejects(repo.checkIn, errors.ConflictError);
  assert.equal(repo.creates(), 0);
});

test('capacity and database unique guards still protect batch check-ins', async () => {
  const full = repository({ counts: [1] });
  await assert.rejects(full.checkIn, errors.BadRequestError);
  assert.equal(full.creates(), 0);
  const race = repository({ counts: [0, 2] });
  await assert.rejects(race.checkIn, errors.BadRequestError);
  assert.equal(race.deletes(), 1);
  const duplicate = repository({ createError: 'P2002' });
  await assert.rejects(duplicate.checkIn, errors.ConflictError);
});
