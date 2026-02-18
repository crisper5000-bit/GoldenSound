import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context";
import type { Genre } from "../types";

const STAR = "\u2605";

interface SellerTrack {
  id: string;
  title: string;
  description: string;
  authorName: string;
  price: number;
  genre: Genre;
  status: string;
  salesCount: number;
  averageRating: number;
  latestModeration: {
    status: string;
    note?: string | null;
  } | null;
}

interface DashboardTrack {
  id: string;
  title: string;
  status: string;
  salesCount: number;
  revenue: number;
  averageRating: number;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    author: string;
    createdAt: string;
  }>;
}

export function SellerPage() {
  const { token } = useAuth();
  const [tracks, setTracks] = useState<SellerTrack[]>([]);
  const [dashboard, setDashboard] = useState<DashboardTrack[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [genreId, setGenreId] = useState("");
  const [price, setPrice] = useState("4.99");
  const [media, setMedia] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);

  const [editPrice, setEditPrice] = useState<Record<string, string>>({});
  const [editTitle, setEditTitle] = useState<Record<string, string>>({});
  const [editDescription, setEditDescription] = useState<Record<string, string>>({});
  const [editGenre, setEditGenre] = useState<Record<string, string>>({});

  const loadData = async () => {
    if (!token) return;

    const [tracksResponse, dashboardResponse, genresResponse] = await Promise.all([
      apiRequest<{ tracks: SellerTrack[] }>("/seller/tracks", { token }),
      apiRequest<{ tracks: DashboardTrack[] }>("/seller/dashboard", { token }),
      apiRequest<{ genres: Genre[] }>("/catalog/genres")
    ]);

    setTracks(tracksResponse.tracks);
    setDashboard(dashboardResponse.tracks);
    setGenres(genresResponse.genres);

    setEditPrice(
      Object.fromEntries(tracksResponse.tracks.map((track) => [track.id, track.price.toString()]))
    );
    setEditTitle(Object.fromEntries(tracksResponse.tracks.map((track) => [track.id, track.title])));
    setEditDescription(
      Object.fromEntries(tracksResponse.tracks.map((track) => [track.id, track.description]))
    );
    setEditGenre(Object.fromEntries(tracksResponse.tracks.map((track) => [track.id, track.genre.id])));

    if (!genreId && genresResponse.genres[0]) {
      setGenreId(genresResponse.genres[0].id);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const submitTrack = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    if (!media) {
      setMessage("Нужно выбрать аудио-файл трека");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("authorName", authorName);
    formData.append("genreId", genreId);
    formData.append("price", price);
    formData.append("media", media);
    if (cover) {
      formData.append("cover", cover);
    }

    await apiRequest("/seller/tracks", {
      method: "POST",
      token,
      body: formData
    });

    setMessage("Трек отправлен на модерацию");
    setTitle("");
    setDescription("");
    setAuthorName("");
    setMedia(null);
    setCover(null);
    await loadData();
  };

  const requestUpdate = async (trackId: string) => {
    if (!token) return;

    const formData = new FormData();
    formData.append("title", editTitle[trackId]);
    formData.append("description", editDescription[trackId]);
    formData.append("price", editPrice[trackId]);
    formData.append("genreId", editGenre[trackId]);

    await apiRequest(`/seller/tracks/${trackId}`, {
      method: "PATCH",
      token,
      body: formData
    });

    setMessage("Изменения отправлены на модерацию");
    await loadData();
  };

  const requestDelete = async (trackId: string) => {
    if (!token) return;

    await apiRequest(`/seller/tracks/${trackId}`, {
      method: "DELETE",
      token
    });

    setMessage("Запрос на удаление отправлен в модерацию");
    await loadData();
  };

  return (
    <section className="panel">
      <h1>Бизнес кабинет</h1>
      {message && <p className="state">{message}</p>}

      <div className="seller-grid">
        <div className="panel">
          <h2>Добавить новый трек</h2>
          <form className="form" onSubmit={submitTrack}>
            <label>
              Название
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label>
              Описание
              <textarea
                className="input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </label>
            <label>
              Автор
              <input className="input" value={authorName} onChange={(event) => setAuthorName(event.target.value)} />
            </label>
            <label>
              Жанр
              <select className="input" value={genreId} onChange={(event) => setGenreId(event.target.value)}>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Цена
              <input className="input" type="number" step={0.01} value={price} onChange={(event) => setPrice(event.target.value)} />
            </label>
            <label>
              Аудио файл
              <input className="input" type="file" accept="audio/*" onChange={(event) => setMedia(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              Обложка
              <input className="input" type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0] ?? null)} />
            </label>
            <button className="btn" type="submit">
              Отправить на модерацию
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Статистика продаж и отзывов</h2>
          {dashboard.map((entry) => (
            <article className="seller-stat" key={entry.id}>
              <h3>{entry.title}</h3>
              <p>Статус: {entry.status}</p>
              <p>Продажи: {entry.salesCount}</p>
              <p>Выручка: {entry.revenue.toFixed(2)} {"\u20BD"}</p>
              <p>
                Средняя оценка: {STAR} {entry.averageRating.toFixed(1)}
              </p>
              <p className="muted">Отзывы:</p>
              {entry.reviews.slice(0, 3).map((review) => (
                <p key={review.id} className="muted">
                  {review.author}: {STAR.repeat(review.rating)} - {review.comment}
                </p>
              ))}
            </article>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Мои треки</h2>
        <div className="seller-list">
          {tracks.map((track) => (
            <article key={track.id} className="seller-track">
              <div>
                <h3>{track.title}</h3>
                <p>Статус: {track.status}</p>
                <p>Продажи: {track.salesCount}</p>
                <p>
                  Средняя оценка: {STAR} {track.averageRating.toFixed(1)}
                </p>
                {track.latestModeration && (
                  <p className="muted">
                    Последняя модерация: {track.latestModeration.status}
                    {track.latestModeration.note ? ` (${track.latestModeration.note})` : ""}
                  </p>
                )}
              </div>

              <div className="seller-track__edit">
                <input
                  className="input"
                  value={editTitle[track.id] ?? ""}
                  onChange={(event) =>
                    setEditTitle((prev) => ({
                      ...prev,
                      [track.id]: event.target.value
                    }))
                  }
                />
                <textarea
                  className="input"
                  value={editDescription[track.id] ?? ""}
                  onChange={(event) =>
                    setEditDescription((prev) => ({
                      ...prev,
                      [track.id]: event.target.value
                    }))
                  }
                />
                <input
                  className="input"
                  type="number"
                  step={0.01}
                  value={editPrice[track.id] ?? ""}
                  onChange={(event) =>
                    setEditPrice((prev) => ({
                      ...prev,
                      [track.id]: event.target.value
                    }))
                  }
                />
                <select
                  className="input"
                  value={editGenre[track.id] ?? track.genre.id}
                  onChange={(event) =>
                    setEditGenre((prev) => ({
                      ...prev,
                      [track.id]: event.target.value
                    }))
                  }
                >
                  {genres.map((genre) => (
                    <option key={genre.id} value={genre.id}>
                      {genre.name}
                    </option>
                  ))}
                </select>
                <div className="row gap-sm">
                  <button className="btn" onClick={() => void requestUpdate(track.id)}>
                    Отправить изменение
                  </button>
                  <button className="btn btn--danger" onClick={() => void requestDelete(track.id)}>
                    Удалить (через модерацию)
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}



