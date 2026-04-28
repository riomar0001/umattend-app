import express from 'express';
import authController from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  loginRateLimiter,
  oauthRateLimiter,
  refreshRateLimiter,
} from '../middlewares/rateLimiter.middleware';

const router = express.Router();

router.get('/google', oauthRateLimiter, authController.googleAuth);
router.get('/google/callback', oauthRateLimiter, authController.googleCallback);
router.post('/refresh', refreshRateLimiter, authController.refreshAccessToken);
router.post(
  '/logout',
  authMiddleware,
  loginRateLimiter,
  authController.logoutUser
);
router.post('/exchange', loginRateLimiter, authController.exhangeCode);
router.get(
  '/login-history',
  authMiddleware,
  loginRateLimiter,
  authController.getLoginHistory
);

export default router;
