import { Router, Request, Response } from 'express';
import { cookieOrBearerAuth } from '../middlewares/cookieOrBearerAuth.middleware';
import { checkRole } from '../middlewares/role.middleware';
import register from '../../telemetry/index';

const router = Router();

/**
 * @route   GET /api/v1/metrics
 * @desc    Prometheus metrics (admin only)
 * @access  Private — admin
 */
router.get(
  '/',
  cookieOrBearerAuth,
  checkRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (err) {
      res.status(500).end(String(err));
    }
  }
);

export default router;
