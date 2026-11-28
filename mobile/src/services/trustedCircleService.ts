import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { TrustedContact, TrustedCircleSettings, PublicEmergencyTracking } from "../types";
import { saveCachedTrustedContacts, getCachedTrustedContacts } from "../database/sqlite";
import { useAuthStore } from "../store/authStore";

const CACHE_KEY = "@resqnet_trusted_circle";

export const getTrustedCircle = async (): Promise<{
  contacts: TrustedContact[];
  settings: TrustedCircleSettings;
}> => {
  try {
    const res = await api.get("/users/trusted-circle");
    if (res.data?.data) {
      const { contacts = [] } = res.data.data;
      void saveCachedTrustedContacts(contacts);
      void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(res.data.data)).catch(() => {});
      return res.data.data;
    }
  } catch {
    // Offline / network failure: Read from SQLite first, then AsyncStorage, then AuthStore
    const sqliteContacts = await getCachedTrustedContacts();
    let cachedSettings: TrustedCircleSettings = {
      autoAlertEnabled: true,
      includeLiveLocation: true,
      notifyOnCriticalOnly: false,
      customAlertMessage: "",
    };

    try {
      const asyncData = await AsyncStorage.getItem(CACHE_KEY);
      if (asyncData) {
        const parsed = JSON.parse(asyncData);
        if (parsed.settings) cachedSettings = parsed.settings;
        if ((!sqliteContacts || sqliteContacts.length === 0) && Array.isArray(parsed.contacts)) {
          return { contacts: parsed.contacts, settings: cachedSettings };
        }
      }
    } catch {}

    if (sqliteContacts && sqliteContacts.length > 0) {
      return { contacts: sqliteContacts, settings: cachedSettings };
    }

    // Fallback to Zustand authStore user
    const authUser = useAuthStore.getState().user;
    if (authUser?.trustedContacts && authUser.trustedContacts.length > 0) {
      return {
        contacts: authUser.trustedContacts,
        settings: authUser.trustedCircleSettings || cachedSettings,
      };
    }
  }

  return {
    contacts: [],
    settings: {
      autoAlertEnabled: true,
      includeLiveLocation: true,
      notifyOnCriticalOnly: false,
      customAlertMessage: "",
    },
  };
};

export const addTrustedContact = async (
  contact: Omit<TrustedContact, "_id" | "createdAt">
): Promise<TrustedContact[]> => {
  const res = await api.post("/users/trusted-contacts", contact);
  const contacts: TrustedContact[] = res.data.data.contacts;
  void saveCachedTrustedContacts(contacts);
  void AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ contacts })).catch(() => {});
  return contacts;
};

export const updateTrustedContact = async (
  contactId: string,
  contact: Partial<TrustedContact>
): Promise<TrustedContact[]> => {
  const res = await api.put(`/users/trusted-contacts/${contactId}`, contact);
  const contacts: TrustedContact[] = res.data.data.contacts;
  void saveCachedTrustedContacts(contacts);
  void AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ contacts })).catch(() => {});
  return contacts;
};

export const deleteTrustedContact = async (contactId: string): Promise<TrustedContact[]> => {
  const res = await api.delete(`/users/trusted-contacts/${contactId}`);
  const contacts: TrustedContact[] = res.data.data.contacts;
  void saveCachedTrustedContacts(contacts);
  void AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ contacts })).catch(() => {});
  return contacts;
};

export const updateTrustedCircleSettings = async (
  settings: Partial<TrustedCircleSettings>
): Promise<TrustedCircleSettings> => {
  const res = await api.patch("/users/trusted-circle/settings", settings);
  const updatedSettings: TrustedCircleSettings = res.data.data.settings;
  void AsyncStorage.getItem(CACHE_KEY).then((data) => {
    const existing = data ? JSON.parse(data) : {};
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ ...existing, settings: updatedSettings })).catch(() => {});
  }).catch(() => {});
  return updatedSettings;
};

export const sendTestAlert = async (telemetry?: { batteryLevel?: number | null; networkStatus?: string }): Promise<any> => {
  const res = await api.post("/users/trusted-circle/test-alert", telemetry || {});
  return res.data.data;
};

export const getPublicEmergencyTrack = async (id: string): Promise<PublicEmergencyTracking> => {
  const res = await api.get(`/emergencies/track/${id}`);
  return res.data.data.tracking;
};
