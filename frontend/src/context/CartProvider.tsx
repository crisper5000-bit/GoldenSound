import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "../api/client";
import { CartContext, useAuth } from "./contexts";
import type { CartItem } from "../types";

const GUEST_CART_KEY = "goldensound_guest_cart";

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { user, token } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const guestCartSyncedRef = useRef(false);

  const readGuestCart = useCallback((): CartItem[] => {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as CartItem[];
    } catch {
      return [];
    }
  }, []);

  const writeGuestCart = useCallback((nextItems: CartItem[]) => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(nextItems));
  }, []);

  const refreshCart = useCallback(async () => {
    if (!user || !token) {
      setItems(readGuestCart());
      return;
    }

    const response = await apiRequest<{
      items: Array<{ trackId: string; title: string; authorName: string; price: number; coverUrl?: string | null }>;
    }>("/cart", { token });

    setItems(response.items);
  }, [user, token, readGuestCart]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    const syncGuestCart = async () => {
      if (!user || !token) {
        guestCartSyncedRef.current = false;
        return;
      }

      if (guestCartSyncedRef.current) {
        return;
      }

      const guestItems = readGuestCart();
      if (guestItems.length > 0) {
        await Promise.all(
          guestItems.map((item) =>
            apiRequest("/cart/items", {
              method: "POST",
              token,
              body: { trackId: item.trackId }
            })
          )
        );
        writeGuestCart([]);
      }

      guestCartSyncedRef.current = true;
      await refreshCart();
    };

    void syncGuestCart();
  }, [user, token, readGuestCart, writeGuestCart, refreshCart]);

  const addToCart = useCallback(
    async (item: CartItem) => {
      if (!user || !token) {
        const next = [...readGuestCart().filter((existing) => existing.trackId !== item.trackId), item];
        writeGuestCart(next);
        setItems(next);
        return;
      }

      await apiRequest("/cart/items", {
        method: "POST",
        token,
        body: { trackId: item.trackId }
      });

      await refreshCart();
    },
    [user, token, readGuestCart, writeGuestCart, refreshCart]
  );

  const removeFromCart = useCallback(
    async (trackId: string) => {
      if (!user || !token) {
        const next = readGuestCart().filter((item) => item.trackId !== trackId);
        writeGuestCart(next);
        setItems(next);
        return;
      }

      await apiRequest(`/cart/items/${trackId}`, {
        method: "DELETE",
        token
      });

      await refreshCart();
    },
    [user, token, readGuestCart, writeGuestCart, refreshCart]
  );

  const clearCart = useCallback(async () => {
    if (!user || !token) {
      writeGuestCart([]);
      setItems([]);
      return;
    }

    await Promise.all(items.map((item) => apiRequest(`/cart/items/${item.trackId}`, { method: "DELETE", token })));
    await refreshCart();
  }, [items, user, token, refreshCart, writeGuestCart]);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);

  const value = useMemo(
    () => ({
      items,
      total,
      addToCart,
      removeFromCart,
      clearCart,
      refreshCart
    }),
    [items, total, addToCart, removeFromCart, clearCart, refreshCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
