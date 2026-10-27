import { newDeviceId } from "@auxo/core";
import { SqliteKeyValueStore } from "./sqliteKv.js";

const DEVICE_ID_KEY = "device_id";

/** Returns this install's device ID, generating and persisting one on first use. */
export async function getOrCreateDeviceId(kv: SqliteKeyValueStore = new SqliteKeyValueStore()): Promise<string> {
  const existing = await kv.get(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = newDeviceId();
  await kv.set(DEVICE_ID_KEY, id);
  return id;
}
