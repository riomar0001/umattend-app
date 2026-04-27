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

export default redis;
