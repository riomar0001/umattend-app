import client, { Registry } from 'prom-client';
import { BullMQOtel } from 'bullmq-otel';

const register = new Registry();

register.setDefaultLabels({ app: 'umattend-server' });
client.collectDefaultMetrics({ register });

export const bullmqTelemetry = new BullMQOtel({
  tracerName: 'umattend-bullmq',
  meterName: 'umattend-bullmq',
  version: '1.0.0',
});

export default register;
