import { createContext, useContext } from "react";
import type { CartItem, User, WsNotification } from "../types";

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  notifications: WsNotification[];
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; username: string; role: "USER" | "SELLER" }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface CartContextValue {
  items: CartItem[];
  total: number;
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (trackId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
export const CartContext = createContext<CartContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used inside CartProvider");
  }
  return value;
}
