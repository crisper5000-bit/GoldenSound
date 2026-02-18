import { redis } from "../db/redis.js";

const CATALOG_PATTERN = "catalog:*";

export async function clearCatalogCache(): Promise<void> {
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", CATALOG_PATTERN, "COUNT", 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}
