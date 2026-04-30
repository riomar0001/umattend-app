import Redis, { Command } from 'ioredis';
import {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_DB,
} from '../constants/redis.constants';
import { logStructured } from '../telemetry/logging';

const redis = new Redis({
  host: REDIS_HOST,
  username: REDIS_USERNAME,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD,
  db: REDIS_DB,
});

const origSendCommand = redis.sendCommand.bind(redis);
redis.sendCommand = function (cmd: Command) {
  const start = Date.now();
  const result = origSendCommand(cmd) as Promise<unknown>;
  result
    .then(() => {
      const durationMs = Date.now() - start;
      logStructured(
        'redis',
        'info',
        `REDIS COMMAND ${cmd.name} ${cmd.args.map(String).join(' ')}`,
        {
          'redis.command': cmd.name,
          'redis.args': cmd.args.map(String).join(' '),
          'redis.duration_ms': durationMs,
        }
      );
    })
    .catch((err: Error) => {
      const durationMs = Date.now() - start;
      logStructured(
        'redis',
        'error',
        `REDIS COMMAND ${cmd.name} ${cmd.args.map(String).join(' ')}`,
        {
          'redis.command': cmd.name,
          'redis.args': cmd.args.map(String).join(' '),
          'redis.duration_ms': durationMs,
          'redis.error': err.message,
        }
      );
    });
  return result;
};

export default redis;
