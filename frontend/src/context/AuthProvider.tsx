import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiRequest, wsBaseUrl } from "../api/client";
import { AuthContext } from "./contexts";
import type { User, WsNotification } from "../types";

const TOKEN_KEY = "goldensound_token";

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<WsNotification[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }

    const response = await apiRequest<{ user: User }>("/auth/me", { token });
    setUser(response.user);
  }, [token]);

  const loadNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      return;
    }

    const response = await apiRequest<{ notifications: WsNotification[] }>("/users/notifications", {
      token
    });

    setNotifications(response.notifications);
  }, [token]);

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      if (!token) {
        return;
      }

      setNotifications((prev) =>
        prev.map((notification) =>
          notification.id === notificationId ? { ...notification, isRead: true } : notification
        )
      );

      try {
        await apiRequest(`/users/notifications/${notificationId}/read`, {
          method: "PATCH",
          token
        });
      } catch {
        // Silent fail: notification will still be marked as read in UI.
      }
    },
    [token]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!token) {
      return;
    }

    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));

    try {
      await apiRequest("/users/notifications/read-all", {
        method: "PATCH",
        token
      });
    } catch {
      // Silent fail: count is already reset in UI.
    }
  }, [token]);

  useEffect(() => {
    const init = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        await Promise.all([refreshProfile(), loadNotifications()]);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [token, refreshProfile, loadNotifications]);

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    const ws = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          payload: WsNotification;
        };

        if (data.type === "notification") {
          setNotifications((prev) => [{ ...data.payload, isRead: false }, ...prev].slice(0, 30));
        }
      } catch {
        // Ignore invalid ws messages.
      }
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email, password }
    });

    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; username: string; role: "USER" | "SELLER" }) => {
      const response = await apiRequest<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: input
      });

      localStorage.setItem(TOKEN_KEY, response.token);
      setToken(response.token);
      setUser(response.user);
    },
    []
  );

  const logout = useCallback(async () => {
    if (token) {
      await apiRequest("/auth/logout", { method: "POST", token }).catch(() => undefined);
    }

    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setNotifications([]);
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      login,
      register,
      logout,
      refreshProfile
    }),
    [
      user,
      token,
      loading,
      notifications,
      markNotificationRead,
      markAllNotificationsRead,
      login,
      register,
      logout,
      refreshProfile
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
