import { AxiosError } from "axios";

/** True when the request never reached a server (offline, timeout, CORS, DNS, etc.). */
export const isNetworkError = (error: unknown): boolean => {
  const err = error as AxiosError | undefined;
  if (!err) return false;
  if (!err.response) return true;
  return err.code === "ERR_NETWORK" || err.code === "ECONNABORTED";
};

/** Extract the most useful message from an API error response. */
export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const err = error as AxiosError<{ message?: string; errors?: { message?: string }[] }> | undefined;
  const data = err?.response?.data;

  if (data?.errors?.length) {
    const messages = data.errors.map((item) => item.message).filter(Boolean) as string[];
    if (messages.length) return messages.join(". ");
  }
  if (data?.message) return data.message;

  if (err?.code === "ECONNABORTED") {
    return "The request timed out. Check your connection and try again.";
  }
  if (isNetworkError(err)) {
    return "Cannot reach the ResQNet server. Check your connection and try again.";
  }
  return err?.message || fallback;
};
