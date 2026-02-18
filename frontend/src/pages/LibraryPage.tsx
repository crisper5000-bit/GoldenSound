import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiBaseUrl, apiRequest } from "../api/client";
import { useAuth } from "../context";
import type { LibraryTrack } from "../types";

interface Order {
  id: string;
  total: number;
  createdAt: string;
  items: Array<{
    trackId: string;
    title: string;
    authorName: string;
    price: number;
    coverUrl?: string | null;
  }>;
}

export function LibraryPage() {
  const { token } = useAuth();
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      const [tracksResponse, ordersResponse] = await Promise.all([
        apiRequest<{ tracks: LibraryTrack[] }>("/library/tracks", { token }),
        apiRequest<{ orders: Order[] }>("/library/orders", { token })
      ]);

      setTracks(tracksResponse.tracks);
      setOrders(ordersResponse.orders);
    };

    void loadData();
  }, [token]);

  return (
    <section className="panel">
      <h1>Медиатека</h1>

      <div className="row row--between">
        <p className="muted">Здесь находятся все купленные треки и история заказов.</p>
        <Link className="btn" to="/playlists">
          Открыть панель плейлистов
        </Link>
      </div>

      <div className="panel">
        <h2>Купленные треки</h2>
        {tracks.length === 0 && <p className="muted">Пока нет купленных треков</p>}
        {tracks.map((item) => (
          <article className="library-track" key={item.track.id}>
            <img
              src={item.track.coverUrl ? `${apiBaseUrl}${item.track.coverUrl}` : "https://placehold.co/130x90?text=Track"}
              alt={item.track.title}
            />
            <div>
              <h3>{item.track.title}</h3>
              <p className="muted">
                {item.track.authorName} · {item.track.genre.name}
              </p>
              <p className="muted">Куплен: {new Date(item.purchasedAt).toLocaleString()}</p>
              <audio controls src={`${apiBaseUrl}${item.track.mediaUrl}`} />
            </div>
          </article>
        ))}
      </div>

      <div className="panel">
        <h2>История покупок</h2>
        {orders.length === 0 && <p className="muted">Покупок пока нет</p>}
        {orders.map((order) => (
          <article className="order-card" key={order.id}>
            <p>
              Заказ {order.id} · {new Date(order.createdAt).toLocaleString()} · {order.total.toFixed(2)} ₽
            </p>
            {order.items.map((item) => (
              <p className="muted" key={`${order.id}-${item.trackId}`}>
                {item.title} - {item.price.toFixed(2)} ₽
              </p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
