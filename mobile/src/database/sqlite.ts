import * as SQLite from "expo-sqlite";
import { TrustedContact } from "../types";

let dbInstance: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("resqnet_offline.db");
    await initDatabase(dbInstance);
  }
  return dbInstance;
};

export const initDatabase = async (db: SQLite.SQLiteDatabase) => {
  // Offline cached emergencies table
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cached_emergencies (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS offline_sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cached_trusted_contacts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      relationship TEXT,
      notify_on_sos INTEGER NOT NULL DEFAULT 1
    );
  `);
};

export const saveCachedTrustedContacts = async (
  contacts: TrustedContact[]
): Promise<void> => {
  try {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.execAsync("DELETE FROM cached_trusted_contacts;");
      for (const c of contacts) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_trusted_contacts (id, name, phone, relationship, notify_on_sos)
           VALUES (?, ?, ?, ?, ?);`,
          [
            c._id || c.phone,
            c.name,
            c.phone,
            c.relationship || "other",
            c.notifyOnSOS !== false ? 1 : 0,
          ]
        );
      }
    });
  } catch (err) {
    console.warn("[SQLite] Failed to cache trusted contacts:", err);
  }
};

export const getCachedTrustedContacts = async (): Promise<TrustedContact[]> => {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      phone: string;
      relationship: string;
      notify_on_sos: number;
    }>("SELECT * FROM cached_trusted_contacts;");

    return rows.map((r) => ({
      _id: r.id,
      name: r.name,
      phone: r.phone,
      relationship: (r.relationship as TrustedContact["relationship"]) || "other",
      notifyOnSOS: r.notify_on_sos === 1,
      notifyVia: ["sms"],
    }));
  } catch {
    return [];
  }
};
