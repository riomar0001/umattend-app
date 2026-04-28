import express from 'express';
import adminController from '../controllers/admin.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/role.middleware';
import { checkSchema } from 'express-validator';
import {
  UpdateRoleValidSchema,
  PaginationSchema,
} from '../validators/adminValidSchema';
import { EventValidSchema } from '../validators/addEventValidSchema';

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authMiddleware, checkRole('admin'));

// ---------------------------------------------------------------------------
// Dead Letter Queue
// ---------------------------------------------------------------------------

// GET /queues — list all queues with counts
router.get('/queues', adminController.getQueues);

// POST /queues/:queueName/failed/retry-all — retry all failed (before :jobId)
router.post(
  '/queues/:queueName/failed/retry-all',
  adminController.retryAllFailedJobs
);

// DELETE /queues/:queueName/failed — clean all failed (before :jobId)
router.delete(
  '/queues/:queueName/failed',
  adminController.cleanAllFailedJobs
);

// GET /queues/:queueName/failed — paginated failed jobs
router.get(
  '/queues/:queueName/failed',
  checkSchema(PaginationSchema),
  adminController.getFailedJobs
);

// POST /queues/:queueName/failed/:jobId/retry — retry single job
router.post(
  '/queues/:queueName/failed/:jobId/retry',
  adminController.retryFailedJob
);

// DELETE /queues/:queueName/failed/:jobId — delete single job
router.delete(
  '/queues/:queueName/failed/:jobId',
  adminController.deleteFailedJob
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

// GET /users — paginated user listing
router.get('/users', adminController.getAllUsers);

// GET /users/:userId — single user
router.get('/users/:userId', adminController.getUserById);

// PATCH /users/:userId/role — update user role
router.patch(
  '/users/:userId/role',
  checkSchema(UpdateRoleValidSchema),
  adminController.updateUserRole
);

// DELETE /users/:userId — soft-delete user
router.delete('/users/:userId', adminController.deleteUser);

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// GET /events — paginated event listing (includes drafts)
router.get('/events', adminController.getAllEvents);

// PATCH /events/:eventId — admin override event update
router.patch(
  '/events/:eventId',
  checkSchema(EventValidSchema),
  adminController.updateEvent
);

// ---------------------------------------------------------------------------
// Rate Limits
// ---------------------------------------------------------------------------

// GET /rate-limits — list all active rate limit entries
console.log('[admin.routes] registering rate-limit routes');
router.get('/rate-limits', adminController.getRateLimits);
// fallback test
router.get('/ratelimits', (_req, res) => { res.json({ ok: true, path: 'ratelimits' }); });

// DELETE /rate-limits — clear all rate limits
router.delete('/rate-limits', adminController.deleteAllRateLimits);

// DELETE /rate-limits/:key — clear a specific rate limit entry
router.delete('/rate-limits/:key', adminController.deleteRateLimit);

export default router;
