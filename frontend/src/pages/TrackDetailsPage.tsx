import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiBaseUrl, apiRequest } from "../api/client";
import { useAuth, useCart } from "../context";
import type { TrackDetails } from "../types";

const STAR = "\u2605";

export function TrackDetailsPage() {
  const { trackId } = useParams();
  const [track, setTrack] = useState<TrackDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { user, token } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!trackId) {
      return;
    }

    const fetchTrack = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiRequest<{ track: TrackDetails }>(`/catalog/tracks/${trackId}`);
        setTrack(response.track);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };

    void fetchTrack();
  }, [trackId]);

  const submitReview = async () => {
    if (!user || !token || !trackId) {
      navigate(`/login?redirect=/tracks/${trackId}`);
      return;
    }

    try {
      await apiRequest(`/catalog/tracks/${trackId}/reviews`, {
        method: "POST",
        token,
        body: { rating, comment }
      });
      setComment("");
      alert("Отзыв отправлен на модерацию");
    } catch (requestError) {
      alert(requestError instanceof Error ? requestError.message : "Ошибка отправки отзыва");
    }
  };

  if (loading) {
    return <div className="state">Загрузка трека...</div>;
  }

  if (error || !track) {
    return <div className="state state--error">{error ?? "Трек не найден"}</div>;
  }

  return (
    <section className="panel details">
      <div className="details__hero">
        <img
          src={track.coverUrl ? `${apiBaseUrl}${track.coverUrl}` : "https://placehold.co/540x320?text=GoldenSound"}
          alt={track.title}
        />
        <div>
          <h1>{track.title}</h1>
          <p className="muted">Автор: {track.authorName}</p>
          <p className="muted">Жанр: {track.genre.name}</p>
          <p className="muted">Дата добавления: {new Date(track.createdAt).toLocaleString()}</p>
          <p>{track.description}</p>
          <p className="details__price">{track.price.toFixed(2)} {"\u20BD"}</p>
          <p>
            Средняя оценка: {STAR} {track.averageRating.toFixed(1)}
          </p>
          <button
            className="btn"
            onClick={() =>
              void addToCart({
                trackId: track.id,
                title: track.title,
                authorName: track.authorName,
                price: track.price,
                coverUrl: track.coverUrl
              })
            }
          >
            Добавить в корзину
          </button>
          <audio controls className="audio-player" src={`${apiBaseUrl}${track.mediaUrl}`} />
        </div>
      </div>

      <section className="panel">
        <h2>Оставить отзыв</h2>
        <div className="review-form">
          <label>
            Оценка
            <select className="input" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {STAR.repeat(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Комментарий
            <textarea className="input" value={comment} onChange={(event) => setComment(event.target.value)} />
          </label>
          <button className="btn" onClick={() => void submitReview()}>
            Отправить
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Комментарии</h2>
        {track.reviews.length === 0 && <p className="muted">Пока нет комментариев</p>}
        {track.reviews.map((review) => (
          <article className="review" key={review.id}>
            <div>
              <strong>{review.user.username}</strong>
              <span className="muted"> {new Date(review.createdAt).toLocaleString()}</span>
            </div>
            <p>Оценка: {STAR.repeat(review.rating)}</p>
            <p>{review.comment}</p>
          </article>
        ))}
      </section>
    </section>
  );
}



