import { Router } from 'express';
import { getHealth, getHealthDetailed } from '../controllers/health.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { checkRole } from '../middlewares/role.middleware';

const router = Router();

router.get('/', getHealth);
router.get('/detailed', authMiddleware, checkRole('admin', 'csg'), getHealthDetailed);

export default router;
