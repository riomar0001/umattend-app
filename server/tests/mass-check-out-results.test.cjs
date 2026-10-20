const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../node_modules/typescript');

const moduleUnderTest = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(
      path.resolve(__dirname, '../../client/src/lib/mass-check-out-results.ts'),
      'utf8'
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText,
  { module: moduleUnderTest, exports: moduleUnderTest.exports }
);
const { createMassCheckOutCsv } = moduleUnderTest.exports;

test('reports confirmed checkouts with actual timestamps and each skipped reason', () => {
  const csv = createMassCheckOutCsv(
    'event-1',
    [
      { student_id: 12345, name: 'Jane', umindanao_email: 'jane@example.test' },
      { student_id: 234567 },
      { student_id: 345678 },
      { student_id: 456789 },
      { student_id: 567890 },
    ],
    {
      updatedCount: 1,
      updatedRecords: [
        {
          student_id: 12345,
          student: { name: 'Jane' },
          check_in_at: '2026-10-21T01:00:00.000Z',
          check_out_at: '2026-10-21T02:15:00.000Z',
          check_out_by_user: { umindanao_email: 'organizer@example.test' },
        },
      ],
      alreadyCheckedOut: [234567],
      notCheckedIn: [345678],
      departmentMismatch: [456789],
    }
  );
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"012345","Jane"'));
  assert.ok(
    csv.includes(
      '"Checked out","Checkout confirmed","2026-10-21T01:00:00.000Z","2026-10-21T02:15:00.000Z","organizer@example.test"'
    )
  );
  assert.ok(csv.includes('"Skipped","Student was already checked out"'));
  assert.ok(csv.includes('"Skipped","Student has not checked in"'));
  assert.ok(
    csv.includes('"Skipped","Student department does not match the event"')
  );
  assert.ok(
    csv.includes(
      '"Unconfirmed","No individual result returned. Refresh attendance to verify."'
    )
  );
  assert.equal(csv.split('\r\n').length, 7);
});

test('does not invent individual successes from a summary count or absent checkout timestamp', () => {
  const csv = createMassCheckOutCsv(
    'event',
    [{ student_id: 123456 }, { student_id: 234567 }],
    {
      updatedCount: 2,
      updatedRecords: [{ student_id: 123456, student: {} }],
    }
  );
  assert.equal((csv.match(/"Unconfirmed"/g) ?? []).length, 2);
  assert.ok(!csv.includes('"Checked out"'));
});

test('escapes CSV quotes, commas, newlines and spreadsheet formulas', () => {
  const csv = createMassCheckOutCsv(
    'event',
    [
      {
        student_id: 123456,
        name: 'Doe, "Jane"\nSmith',
        program: '=1+1',
        department: ' \t@SUM(1,1)',
      },
    ],
    {}
  );
  assert.ok(csv.includes('"Doe, ""Jane""\nSmith"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\' \t@SUM(1,1)"'));
});
