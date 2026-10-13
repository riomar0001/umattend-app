import { bindings } from '../worker/runtime';
import { countCache } from './performance';

const store = () => {
  const namespace = bindings().EPHEMERAL_STORE;
  return namespace.get(namespace.idFromName('data-cache:v1'));
};

/** JSON-only results; authorization remains at each calling route. */
export const cachedData = async <T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>
): Promise<T> => {
  if (process.env.DATA_CACHE_ENABLED === 'false') {
    return load();
  }
  let generation: string;
  try {
    const snapshot = await store().getSummary(key);
    generation = snapshot.generation;
    if (snapshot.value !== null) {
      const value = JSON.parse(snapshot.value) as T;
      countCache('hit');
      return value;
    }
  } catch {
    countCache('error');
    return load();
  }
  countCache('miss');
  const value = await load(); // Errors are never cached.
  try {
    await store().putSummary(
      key,
      generation,
      JSON.stringify(value),
      ttlSeconds
    );
  } catch {
    countCache('error');
  }
  return value;
};

export const invalidateDataCache = async (): Promise<void> => {
  try {
    await store().invalidateSummaries();
  } catch {
    countCache('error');
    console.warn(JSON.stringify({ event: 'data_cache_invalidation_failed' }));
  }
};
