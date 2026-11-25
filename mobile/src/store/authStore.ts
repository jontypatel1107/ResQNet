import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { User, UserRole, RegisterPayload, LoginPayload, VolunteerProfile } from "../types";
import { api } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";

interface AuthState {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (payload: LoginPayload) => Promise<{ success: boolean; message?: string }>;
  register: (payload: RegisterPayload) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; phone?: string }) => Promise<{ success: boolean; message?: string }>;
  updateVolunteerProfile: (data: Partial<VolunteerProfile>) => Promise<{ success: boolean; message?: string }>;
  initializeAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  clearError: () => set({ error: null }),

  login: async ({ email, password }: LoginPayload) => {
    try {
      set({ error: null });
      const res = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (res.data?.success) {
        const { user, accessToken, refreshToken } = res.data.data;

        try {
          await SecureStore.setItemAsync("resqnet_access_token", accessToken);
          await SecureStore.setItemAsync("resqnet_refresh_token", refreshToken);
          await SecureStore.setItemAsync("resqnet_user", JSON.stringify(user));
        } catch (e) {
          console.warn("[SecureStore] Warning: Could not write tokens to store", e);
        }

        set({
          user,
          role: user.role,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // Initialize real-time Socket connection
        connectSocket(user.id, user.role);

        return { success: true };
      }
      return { success: false, message: res.data?.message || "Login failed" };
    } catch (err: any) {
      const message = err.response?.data?.message || "Invalid credentials or network failure";
      set({ error: message, isLoading: false });
      return { success: false, message };
    }
  },

  register: async (payload: RegisterPayload) => {
    try {
      set({ error: null });
      const res = await api.post("/auth/register", {
        ...payload,
        email: payload.email.trim().toLowerCase(),
      });

      if (res.data?.success) {
        const { user, accessToken, refreshToken } = res.data.data;

        try {
          await SecureStore.setItemAsync("resqnet_access_token", accessToken);
          await SecureStore.setItemAsync("resqnet_refresh_token", refreshToken);
          await SecureStore.setItemAsync("resqnet_user", JSON.stringify(user));
        } catch (e) {
          console.warn("[SecureStore] Warning: Could not write tokens to store", e);
        }

        set({
          user,
          role: user.role,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        connectSocket(user.id, user.role);

        return { success: true };
      }
      return { success: false, message: res.data?.message || "Registration failed" };
    } catch (err: any) {
      const message = err.response?.data?.message || "Registration error. Check your details.";
      set({ error: message, isLoading: false });
      return { success: false, message };
    }
  },

  updateProfile: async (data: { name?: string; phone?: string }) => {
    try {
      const res = await api.put("/users/profile", data);
      if (res.data?.success) {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...res.data.data.user };
          set({ user: updatedUser });
          await SecureStore.setItemAsync("resqnet_user", JSON.stringify(updatedUser));
        }
        return { success: true };
      }
      return { success: false, message: "Update failed" };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || "Network error" };
    }
  },

  updateVolunteerProfile: async (data: Partial<VolunteerProfile>) => {
    try {
      const res = await api.put("/volunteers/status", data);
      if (res.data?.success) {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser: User = {
            ...currentUser,
            volunteerProfile: {
              ...(currentUser.volunteerProfile || { skills: [], availability: true, serviceRadius: 10 }),
              ...res.data.data.profile,
            },
          };
          set({ user: updatedUser });
          await SecureStore.setItemAsync("resqnet_user", JSON.stringify(updatedUser));
        }
        return { success: true };
      }
      return { success: false, message: "Volunteer update failed" };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || "Network error" };
    }
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync("resqnet_access_token");
      await SecureStore.deleteItemAsync("resqnet_refresh_token");
      await SecureStore.deleteItemAsync("resqnet_user");
    } catch {}

    disconnectSocket();
    set({ user: null, role: null, isAuthenticated: false, isLoading: false, error: null });
  },

  initializeAuth: async () => {
    try {
      const userStr = await SecureStore.getItemAsync("resqnet_user");
      const token = await SecureStore.getItemAsync("resqnet_access_token");

      if (userStr && token) {
        const user: User = JSON.parse(userStr);
        set({
          user,
          role: user.role,
          isAuthenticated: true,
          isLoading: false,
        });

        // Initialize real-time connection in background
        connectSocket(user.id, user.role);

        // Fetch fresh profile in background
        api
          .get("/auth/me")
          .then((res) => {
            if (res.data?.success && res.data.data?.user) {
              const freshUser = res.data.data.user;
              set({ user: freshUser, role: freshUser.role });
              SecureStore.setItemAsync("resqnet_user", JSON.stringify(freshUser));
            }
          })
          .catch(() => {
            // Offline or token refresh will trigger via axios interceptor
          });

        return;
      }
    } catch (e) {
      console.warn("[AuthStore] Failed reading stored session:", e);
    }
    set({ user: null, role: null, isAuthenticated: false, isLoading: false });
  },
}));
