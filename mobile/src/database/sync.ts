import { getDatabase } from "./sqlite";
import { api } from "../services/api";

export const addToSyncQueue = async (action: string, endpoint: string, payload: object) => {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO offline_sync_queue (action, endpoint, payload, created_at, retry_count) VALUES (?, ?, ?, ?, ?)",
    [action, endpoint, JSON.stringify(payload), new Date().toISOString(), 0]
  );
};

export const processSyncQueue = async () => {
  const db = await getDatabase();
  const queue = await db.getAllAsync<{
    id: number;
    action: string;
    endpoint: string;
    payload: string;
    retry_count: number;
  }>("SELECT * FROM offline_sync_queue ORDER BY id ASC LIMIT 20");

  for (const item of queue) {
    try {
      const data = JSON.parse(item.payload);
      if (item.action === "POST") {
        await api.post(item.endpoint, data);
      } else if (item.action === "PUT") {
        await api.put(item.endpoint, data);
      } else if (item.action === "PATCH") {
        await api.patch(item.endpoint, data);
      }
      // Successfully synced: delete item
      await db.runAsync("DELETE FROM offline_sync_queue WHERE id = ?", [item.id]);
    } catch {
      // Increment retry count
      await db.runAsync(
        "UPDATE offline_sync_queue SET retry_count = retry_count + 1 WHERE id = ?",
        [item.id]
      );
    }
  }
};
