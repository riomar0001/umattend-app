import Redis from 'ioredis';
import {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_DB,
} from '../constants/redis.constants';

const redis = new Redis({
  host: REDIS_HOST,
  username: REDIS_USERNAME,
  port: Number(REDIS_PORT),
  password: REDIS_PASSWORD,
  db: REDIS_DB,
});

// Log Redis commands to OTel (captured by logging.ts and sent to Loki)
const origSendCommand = redis.sendCommand.bind(redis);
redis.sendCommand = function (cmd: { name: string; args: unknown[] }) {
  const start = Date.now();
  const result = origSendCommand(cmd);
  result
    .then(() => {
      console.log(
        `REDIS ${cmd.name} ${cmd.args.map(String).join(' ')} ${Date.now() - start}ms`
      );
    })
    .catch(() => {});
  return result;
};

export default redis;
