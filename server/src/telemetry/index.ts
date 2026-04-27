import client, { Registry } from 'prom-client';

const register = new Registry();

register.setDefaultLabels({ app: 'umattend-server' });
client.collectDefaultMetrics({ register });

export default register;
