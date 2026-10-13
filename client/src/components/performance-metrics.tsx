'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';

// One decision per page, so all its metrics have the same sampling rate.
let sampled: boolean | undefined;
const routes = new Set([
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
  '/forbidden'
]);
function routeLabel() {
  const pathname = window.location.pathname;
  if (routes.has(pathname)) return pathname;
  if (/^\/events\/[^/]+\/manage$/.test(pathname)) return '/events/[id]/manage';
  if (/^\/events\/[^/]+$/.test(pathname)) return '/events/[id]';
  return 'other';
}
function report(metric: { name: string; value: number }) {
  if (process.env.NODE_ENV !== 'production') return;
  sampled ??= Math.random() < 0.1;
  if (!sampled || !Number.isFinite(metric.value) || metric.value < 0) return;
  const payload = JSON.stringify({ name: metric.name, value: metric.value, route: routeLabel() });
  navigator.sendBeacon('/api/v1/performance', new Blob([payload], { type: 'application/json' }));
}
export function PerformanceMetrics() {
  useReportWebVitals(report);
  useEffect(() => {
    const onLoad = () => {
      // Read after load completes so loadEventEnd has been populated.
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (navigation?.loadEventEnd) report({ name: 'load', value: navigation.loadEventEnd - navigation.startTime });
      }, 0);
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
