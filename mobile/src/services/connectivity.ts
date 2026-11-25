import NetInfo from "@react-native-community/netinfo";
import { processSyncQueue } from "../database/sync";

export const isOnline = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    // If NetInfo is unavailable, let the actual API request decide.
    return true;
  }
};

let syncing = false;

export const syncPendingWhenOnline = async (): Promise<void> => {
  if (syncing) return;
  if (!(await isOnline())) return;

  syncing = true;
  try {
    await processSyncQueue();
  } finally {
    syncing = false;
  }
};

/**
 * Starts monitoring connectivity and flushes queued SOS requests whenever the
 * device comes back online. Returns an unsubscribe function for cleanup.
 */
export const startAutoSync = (): (() => void) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      void syncPendingWhenOnline();
    }
  });

  void syncPendingWhenOnline();
  return unsubscribe;
};
