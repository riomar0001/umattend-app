const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../node_modules/typescript');

const sourceRoot = path.resolve(__dirname, '../src');
function load(relativePath, imports) {
  const source = fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(name) {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
    console,
  });
  return module.exports;
}

const responses = load('utils/responseHandler.ts', {});
const roles = load('v1/middlewares/role.middleware.ts', {
  '../../utils/responseHandler': responses,
});
const organizers = load('v1/middlewares/checkOrganizer.middleware.ts', {
  '../repositories/event.repository': {
    checkOrganizer: async (userId, eventId) =>
      userId === 'assigned-user' && eventId === 'assigned-event',
  },
  '../../configs/redis.config': {
    get: async () => null,
    set: async () => {},
    del: async () => {},
  },
  '@/utils/responseHandler': responses,
  '@/utils/routeParams': { routeParam: (req, name) => req.params[name] },
});
const routes = [];
const owners = load('v1/middlewares/checkEventOwner.middleware.ts', {
  '../repositories/event.repository': {
    getEventDetails: async (eventId) =>
      eventId === 'assigned-event' ? { created_by: 'creator-user' } : null,
  },
  '@/utils/responseHandler': responses,
  '@/utils/routeParams': { routeParam: (req, name) => req.params[name] },
});
const router = Object.fromEntries(
  ['get', 'post', 'put', 'patch', 'delete'].map((method) => [
    method,
    (route, ...handlers) => routes.push({ method, route, handlers }),
  ])
);
load('v1/routes/event.routes.ts', {
  express: { Router: () => router },
  '../controllers/event.controller': new Proxy(
    {},
    {
      get: (_target, name) =>
        name === '__esModule'
          ? false
          : (_req, res) => res.status(200).json({ success: true }),
    }
  ),
  '../middlewares/auth.middleware': {
    authMiddleware: (req, res, next) =>
      req.user ? next() : res.status(401).json({ success: false }),
  },
  '../middlewares/role.middleware': roles,
  'express-validator': { checkSchema: () => (_req, _res, next) => next() },
  '../validators/addEventValidSchema': {},
  '../middlewares/checkOrganizer.middleware': organizers,
  '../middlewares/checkEventOwner.middleware': owners,
  '../middlewares/rateLimiter.middleware': {
    checkInRateLimiter: (_req, _res, next) => next(),
  },
});

async function request(route, user, eventId = 'assigned-event') {
  const req = { user, params: { event_id: eventId, eventId } };
  const res = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  for (const handler of route.handlers) {
    let continued = false;
    await handler(req, res, () => {
      continued = true;
    });
    if (!continued) break;
  }
  assert.ok(res.body, 'The middleware chain must produce a response');
  return res.statusCode;
}

for (const [method, endpoint] of [
  ['delete', '/:event_id'],
  ['patch', '/:event_id/post'],
  ['patch', '/:event_id/draft'],
  ['put', '/:eventId'],
  ['post', '/mass_check_out/:event_id'],
]) {
  test(`${method} ${endpoint}: only creator or admin, without organizer membership`, async () => {
    const route = routes.find(
      (entry) => entry.method === method && entry.route === endpoint
    );
    assert.ok(route);
    assert.equal(
      await request(route, { id: 'admin-user', role: 'admin' }),
      200
    );
    for (const role of ['student', 'instructor', 'organizer', 'csg']) {
      assert.equal(await request(route, { id: 'creator-user', role }), 200);
      assert.equal(await request(route, { id: 'assigned-user', role }), 403);
      assert.equal(await request(route, { id: 'unrelated-user', role }), 403);
    }
    assert.equal(await request(route, undefined), 401);
    assert.equal(
      await request(
        route,
        { id: 'admin-user', role: 'admin' },
        'missing-event'
      ),
      404
    );
  });
}

for (const endpoint of [
  '/mass_check_in/:event_id',
  '/:event_id/attendees',
  '/:event_id/attendance_count',
  '/:event_id/organizers',
  '/export/:event_id',
]) {
  const route = routes.find(
    (entry) =>
      entry.route === endpoint &&
      entry.method ===
        (endpoint === '/mass_check_in/:event_id' ? 'post' : 'get')
  );
  assert.ok(route, `Missing endpoint: ${endpoint}`);
  test(`${endpoint}: access follows event membership`, async () => {
    for (const role of ['student', 'instructor', 'organizer']) {
      assert.equal(await request(route, { id: 'assigned-user', role }), 200);
      assert.equal(await request(route, { id: 'unrelated-user', role }), 403);
      assert.equal(
        await request(route, { id: 'assigned-user', role }, 'other-event'),
        403
      );
    }
    for (const role of ['admin', 'csg']) {
      assert.equal(await request(route, { id: 'admin-user', role }), 200);
    }
    assert.equal(await request(route, undefined), 401);
  });
}
