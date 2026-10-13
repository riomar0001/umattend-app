import express from 'express';
import { z } from 'zod';
import rateLimitStore from '../../configs/rateLimit.config';
import { clientIp } from '../../utils/clientIp';

const router = express.Router();
const routes = [
  '/',
  '/events',
  '/events/new',
  '/events/past',
  '/events/[id]',
  '/events/[id]/manage',
  '/admin',
  '/admin/users',
  '/admin/events',
  '/admin/queues',
  '/admin/rate-limits',
  '/profile',
  '/profile/settings',
  '/onboarding',
  '/privacy',
  '/terms',
  '/contact',
  '/forbidden',
  'other',
] as const;
const metricSchema = z.object({
  name: z.enum(['TTFB', 'FCP', 'LCP', 'CLS', 'INP', 'FID', 'load']),
  value: z.number().finite().min(0).max(3600000),
  route: z.enum(routes),
});
router.post('/', express.json({ limit: '2kb' }), async (req, res) => {
  const parsed = metricSchema.safeParse(req.body);
  if (!parsed.success) {
    res.sendStatus(400);
    return;
  }
  try {
    if (
      !(await rateLimitStore.allow('performance:' + clientIp(req), 60000, 60))
    ) {
      res.sendStatus(429);
      return;
    }
  } catch {
    res.sendStatus(503);
    return;
  }
  console.log(
    JSON.stringify({
      event: 'web_performance',
      sampleRate: 0.1,
      ...parsed.data,
    })
  );
  res.sendStatus(204);
});
export default router;
