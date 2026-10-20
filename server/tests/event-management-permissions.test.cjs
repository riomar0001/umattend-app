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
    console,
    Error,
  });
  return module.exports;
}
const errors = load('../src/utils/customErrors.ts');
const { canManageEvent } = load('../../client/src/lib/event-permissions.ts');
const event = {
  id: 'event',
  created_by: 'creator',
  is_draft: true,
  check_out_required: false,
};
let saved;
const service = load('../src/v1/services/event.service.ts', {
  '../repositories/event.repository': {
    default: {
      getEventDetails: async () => event,
      getAllEvents: async () => [event],
      getAllPastEvents: async () => [event],
      checkOrganizer: async (userId) => userId === 'organizer',
      getEventCheckinCount: async () => 0,
      updateEvent: async (_eventId, data) => {
        saved = data;
        return { ...event, ...data };
      },
    },
  },
  '@/generated/prisma/client': {},
  '../../constants/app.constants': {},
  '@/utils/customErrors': errors,
  '../queues/endEvent.queue': {},
  '../queues/startEvent.queue': {},
  '../repositories/auth.repository': {},
  '@/worker/eventStatus': { startDueAt: () => null, doneDueAt: () => null },
  '../../utils/dataCache': {},
  '../repositories/student.repository': {
    default: { getStudentByUserId: async () => null },
  },
  '../template/checkIn.email': {},
  '../template/checkOut.email': {},
  './email.service': {},
  '../middlewares/checkOrganizer.middleware': {},
}).default;

test('creator and admin see restricted controls, while other organizers and CSG do not', () => {
  assert.equal(canManageEvent('creator', 'creator', 'csg'), true);
  assert.equal(canManageEvent('creator', 'admin-user', 'admin'), true);
  for (const role of ['organizer', 'csg', 'instructor', 'student']) {
    assert.equal(canManageEvent('creator', 'other', role), false);
  }
  assert.equal(canManageEvent(undefined, undefined, undefined), false);
});

test('admin gets Manage Event access to drafts without organizer membership or a student profile', async () => {
  const detail = await service.getEventDetailsById(
    'event',
    'admin-user',
    'admin'
  );
  assert.equal(detail.can_edit, true);
  assert.equal(detail.user_attendance.check_in_at, null);
  for (const getList of [service.getAllEvents, service.getAllPastEvents]) {
    assert.equal(
      (await getList('admin-user', true, 'admin'))[0].can_edit,
      true
    );
    assert.equal((await getList('other-csg', true, 'csg'))[0].can_edit, false);
    assert.equal((await getList('creator', true, 'csg'))[0].can_edit, true);
    assert.equal((await getList('organizer'))[0].can_edit, true);
  }
});

test('admin edit preserves the original creator and noncreator edits are rejected', async () => {
  await service.updateEvent(
    'event',
    { created_by: 'admin-user', title: 'Admin edit' },
    true
  );
  assert.equal(saved.created_by, 'creator');
  assert.equal(saved.title, 'Admin edit');
  await assert.rejects(
    () => service.updateEvent('event', { created_by: 'other' }),
    errors.ForbiddenError
  );
  await service.updateEvent('event', {
    created_by: 'creator',
    title: 'Creator edit',
  });
  assert.equal(saved.created_by, 'creator');
});
