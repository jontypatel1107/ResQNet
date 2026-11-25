import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

const DEFAULT_PORT = 5000;
const FALLBACK_PORTS = [5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007];
const HEALTH_TIMEOUT_MS = 1200;
const CACHE_TTL_MS = 30_000;

let cachedRoot: string | null = null;
let cachedAt = 0;
let pendingDiscovery: Promise<string> | null = null;

const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envSocketUrl = process.env.EXPO_PUBLIC_SOCKET_URL;

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const isLocalUrl = (value?: string) => !value || /localhost|127\.0\.0\.1/.test(value);

const explicitRoot = (() => {
  if (!isLocalUrl(envSocketUrl)) return stripTrailingSlash(envSocketUrl as string);
  if (!isLocalUrl(envApiUrl)) {
    return stripTrailingSlash(envApiUrl as string).replace(/\/api$/, "");
  }
  return null;
})();

const preferredPort = (() => {
  const match = envApiUrl?.match(/:(\d{2,5})(?:\/|$)/);
  const parsed = match ? Number(match[1]) : DEFAULT_PORT;
  return Number.isInteger(parsed) ? parsed : DEFAULT_PORT;
})();

const getHosts = (): string[] => {
  if (explicitRoot) return [explicitRoot];

  const hosts: string[] = [];
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) hosts.push(`http://${hostUri.split(":")[0]}`);
  if (Platform.OS === "android") hosts.push("http://10.0.2.2");
  hosts.push("http://localhost");

  return [...new Set(hosts)];
};

export const getServerRootCandidates = (): string[] => {
  if (explicitRoot) return [explicitRoot];

  const ports = [preferredPort, ...FALLBACK_PORTS.filter((port) => port !== preferredPort)];
  return getHosts().flatMap((host) => ports.map((port) => `${host}:${port}`));
};

type HealthyServer = {
  root: string;
  startedAt: number;
  order: number;
};

const probeServer = async (root: string, order: number): Promise<HealthyServer> => {
  const response = await axios.get(`${root}/api/health`, {
    timeout: HEALTH_TIMEOUT_MS,
  });
  const data = response.data;

  if (!data?.success || data?.service !== "ResQNet Backend") {
    throw new Error("Not a healthy ResQNet backend");
  }

  return {
    root,
    startedAt: data.startedAt ? Date.parse(data.startedAt) || 0 : 0,
    order,
  };
};

const discoverServerRoot = async (): Promise<string> => {
  const candidates = getServerRootCandidates();
  const results = await Promise.allSettled(
    candidates.map((root, index) => probeServer(root, index))
  );

  const healthy = results
    .filter((result): result is PromiseFulfilledResult<HealthyServer> => result.status === "fulfilled")
    .map((result) => result.value);

  if (healthy.length === 0) return candidates[0];

  // Prefer the most recently started healthy backend so a newly started
  // fallback instance wins over a stale server left on the preferred port.
  healthy.sort((a, b) => b.startedAt - a.startedAt || a.order - b.order);
  return healthy[0].root;
};

export const ensureServerBaseUrl = async (): Promise<string> => {
  const now = Date.now();
  if (cachedRoot && now - cachedAt < CACHE_TTL_MS) return cachedRoot;

  if (!pendingDiscovery) {
    pendingDiscovery = (async () => {
      cachedRoot = await discoverServerRoot();
      cachedAt = Date.now();
      return cachedRoot;
    })().finally(() => {
      pendingDiscovery = null;
    });
  }

  return pendingDiscovery;
};

export const clearServerBaseUrlCache = () => {
  cachedRoot = null;
  cachedAt = 0;
};

export const getServerBaseUrl = (): string => cachedRoot || getServerRootCandidates()[0];
export const getApiBaseUrl = (): string => `${getServerBaseUrl()}/api`;
export const getSocketUrl = (): string => getServerBaseUrl();
