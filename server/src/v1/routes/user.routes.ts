import express from 'express';
import userController from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = express.Router();

router.get('/', authMiddleware, userController.getUserById);
router.get('/attendance-token', authMiddleware, userController.getAttendanceToken);
router.get('/events/:id', userController.getUserAttendedEvents);
router.get(
  '/attended-events',
  authMiddleware,
  userController.getUserAttendedEventsDetailed
);
router.get(
  '/hosted-events',
  authMiddleware,
  userController.getUserHostedEvents
);
router.post('/onboarding', authMiddleware, userController.onboardUser);
router.put('/', authMiddleware, userController.updateUserProfile);
export default router;
