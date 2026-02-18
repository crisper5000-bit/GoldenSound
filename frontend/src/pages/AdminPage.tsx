import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../context";
import type { Genre, User } from "../types";

const STAR = "\u2605";
const ALLOWED_TABS = new Set(["tracks", "reviews", "users", "genres", "reports"]);

interface TrackModerationRequest {
  id: string;
  type: string;
  status: string;
  note?: string | null;
  createdAt: string;
  seller: {
    id: string;
    username: string;
    email: string;
  };
  track: {
    id: string;
    title: string;
    status: string;
  } | null;
}

interface ReviewModeration {
  id: string;
  rating: number;
  comment: string;
  track: {
    id: string;
    title: string;
    sellerId: string;
  };
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface AdminUser extends User {
  isBlocked: boolean;
  createdAt: string;
}

interface SalesReport {
  totalOrders: number;
  totalRevenue: number;
  orders: Array<{
    id: string;
    createdAt: string;
    total: number;
    buyer: {
      username: string;
      email: string;
    };
  }>;
}

interface ActivityReport {
  logs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    createdAt: string;
    user?: {
      username: string;
      email: string;
      role: string;
    } | null;
  }>;
}

export function AdminPage() {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTabFromQuery = useMemo(() => {
    const rawTab = searchParams.get("tab");
    if (rawTab && ALLOWED_TABS.has(rawTab)) {
      return rawTab;
    }
    return "tracks";
  }, [searchParams]);
  const [activeTab, setActiveTab] = useState(selectedTabFromQuery);
  const [trackRequests, setTrackRequests] = useState<TrackModerationRequest[]>([]);
  const [reviewRequests, setReviewRequests] = useState<ReviewModeration[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [activity, setActivity] = useState<ActivityReport | null>(null);
  const [newGenre, setNewGenre] = useState("");

  const loadData = async () => {
    if (!token) return;

    const [tracksResponse, reviewsResponse, usersResponse, genresResponse, salesResponse, activityResponse] =
      await Promise.all([
        apiRequest<{ requests: TrackModerationRequest[] }>("/admin/moderation/tracks", { token }),
        apiRequest<{ reviews: ReviewModeration[] }>("/admin/moderation/reviews", { token }),
        apiRequest<{ users: AdminUser[] }>("/admin/users", { token }),
        apiRequest<{ genres: Genre[] }>("/admin/genres", { token }),
        apiRequest<SalesReport>("/admin/reports/sales", { token }),
        apiRequest<ActivityReport>("/admin/reports/activity", { token })
      ]);

    setTrackRequests(tracksResponse.requests);
    setReviewRequests(reviewsResponse.reviews);
    setUsers(usersResponse.users);
    setGenres(genresResponse.genres);
    setSales(salesResponse);
    setActivity(activityResponse);
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  useEffect(() => {
    setActiveTab(selectedTabFromQuery);
  }, [selectedTabFromQuery]);

  const moderateTrack = async (id: string, action: "approve" | "reject") => {
    if (!token) return;

    const note = window.prompt("Комментарий модератора (необязательно)") ?? undefined;

    await apiRequest(`/admin/moderation/tracks/${id}/${action}`, {
      method: "POST",
      token,
      body: { note }
    });

    await loadData();
  };

  const moderateReview = async (id: string, action: "approve" | "reject") => {
    if (!token) return;

    const note = window.prompt("Комментарий модератора (необязательно)") ?? undefined;
    await apiRequest(`/admin/moderation/reviews/${id}/${action}`, {
      method: "POST",
      token,
      body: { note }
    });

    await loadData();
  };

  const toggleBlock = async (id: string, isBlocked: boolean) => {
    if (!token) return;

    await apiRequest(`/admin/users/${id}/${isBlocked ? "unblock" : "block"}`, {
      method: "POST",
      token
    });

    await loadData();
  };

  const createGenre = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !newGenre.trim()) return;

    await apiRequest("/admin/genres", {
      method: "POST",
      token,
      body: { name: newGenre }
    });

    setNewGenre("");
    await loadData();
  };

  const deleteGenre = async (id: string) => {
    if (!token) return;

    await apiRequest(`/admin/genres/${id}`, {
      method: "DELETE",
      token
    });

    await loadData();
  };

  return (
    <section className="panel admin-page">
      <h1>Панель модерации</h1>
      <Tabs.Root
        value={activeTab}
        onValueChange={(nextTab) => {
          setActiveTab(nextTab);
          const nextParams = new URLSearchParams(searchParams);
          nextParams.set("tab", nextTab);
          setSearchParams(nextParams, { replace: true });
        }}
        className="tabs-root"
      >
        <Tabs.List className="tabs-list">
          <Tabs.Trigger className="tabs-trigger" value="tracks">
            Треки
          </Tabs.Trigger>
          <Tabs.Trigger className="tabs-trigger" value="reviews">
            Отзывы
          </Tabs.Trigger>
          <Tabs.Trigger className="tabs-trigger" value="users">
            Пользователи
          </Tabs.Trigger>
          <Tabs.Trigger className="tabs-trigger" value="genres">
            Жанры
          </Tabs.Trigger>
          <Tabs.Trigger className="tabs-trigger" value="reports">
            Отчёты
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="tracks" className="panel">
          <h2>Модерация треков</h2>
          {trackRequests.map((request) => (
            <article key={request.id} className="moderation-card">
              <p>
                {request.type} · продавец {request.seller.username} · трек {request.track?.title ?? "-"}
              </p>
              <p className="muted">{new Date(request.createdAt).toLocaleString()}</p>
              <div className="row gap-sm">
                <button className="btn" onClick={() => void moderateTrack(request.id, "approve")}>Одобрить</button>
                <button className="btn btn--danger" onClick={() => void moderateTrack(request.id, "reject")}>
                  Отклонить
                </button>
              </div>
            </article>
          ))}
        </Tabs.Content>

        <Tabs.Content value="reviews" className="panel">
          <h2>Модерация отзывов</h2>
          {reviewRequests.map((review) => (
            <article key={review.id} className="moderation-card">
              <p>
                {review.user.username} · {review.track.title} · {STAR.repeat(review.rating)}
              </p>
              <p>{review.comment}</p>
              <div className="row gap-sm">
                <button className="btn" onClick={() => void moderateReview(review.id, "approve")}>Одобрить</button>
                <button className="btn btn--danger" onClick={() => void moderateReview(review.id, "reject")}>
                  Отклонить
                </button>
              </div>
            </article>
          ))}
        </Tabs.Content>

        <Tabs.Content value="users" className="panel">
          <h2>Пользователи и продавцы</h2>
          {users.map((entry) => (
            <article key={entry.id} className="moderation-card row row--between">
              <div>
                <p>
                  {entry.username} · {entry.email} · {entry.role}
                </p>
                <p className="muted">Статус: {entry.isBlocked ? "заблокирован" : "активен"}</p>
              </div>
              <button className="btn" onClick={() => void toggleBlock(entry.id, entry.isBlocked)}>
                {entry.isBlocked ? "Разблокировать" : "Заблокировать"}
              </button>
            </article>
          ))}
        </Tabs.Content>

        <Tabs.Content value="genres" className="panel">
          <h2>Управление жанрами</h2>
          <form className="form" onSubmit={createGenre}>
            <input
              className="input"
              placeholder="Новый жанр"
              value={newGenre}
              onChange={(event) => setNewGenre(event.target.value)}
            />
            <button className="btn" type="submit">
              Добавить жанр
            </button>
          </form>
          {genres.map((genre) => (
            <div className="row row--between" key={genre.id}>
              <span>{genre.name}</span>
              <button className="btn btn--danger" onClick={() => void deleteGenre(genre.id)}>
                Удалить
              </button>
            </div>
          ))}
        </Tabs.Content>

        <Tabs.Content value="reports" className="panel">
          <h2>Отчётность</h2>
          <p>Заказов: {sales?.totalOrders ?? 0}</p>
          <p>Выручка: {sales?.totalRevenue.toFixed(2) ?? "0.00"} {"\u20BD"}</p>

          <h3>Последние продажи</h3>
          {sales?.orders.slice(0, 10).map((order) => (
            <p key={order.id} className="muted">
              {new Date(order.createdAt).toLocaleString()} · {order.buyer.email} · {order.total.toFixed(2)} {"\u20BD"}
            </p>
          ))}

          <h3>Логи действий</h3>
          {activity?.logs.slice(0, 30).map((log) => (
            <p key={log.id} className="muted">
              {new Date(log.createdAt).toLocaleString()} · {log.action} · {log.entityType}
              {log.user ? ` · ?{log.user.email}` : ""}
            </p>
          ))}
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}



