import express from 'express';
import authController from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
  loginRateLimiter,
  oauthRateLimiter,
} from '../middlewares/rateLimiter.middleware';

const router = express.Router();

router.get('/google', oauthRateLimiter, authController.googleAuth);
router.get('/google/callback', oauthRateLimiter, authController.googleCallback);
router.post('/refresh', authMiddleware, loginRateLimiter, authController.refreshAccessToken);
router.post('/logout', authMiddleware, loginRateLimiter, authController.logoutUser);
router.post('/exchange', oauthRateLimiter, authController.exhangeCode);
router.get('/login-history', authMiddleware, loginRateLimiter, authController.getLoginHistory);

export default router;
