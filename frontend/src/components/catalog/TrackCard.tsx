import { Link } from "react-router-dom";
import { apiBaseUrl } from "../../api/client";
import type { TrackCardItem } from "../../types";

interface TrackCardProps {
  track: TrackCardItem;
  onAdd: (track: TrackCardItem) => void;
}

export function TrackCard({ track, onAdd }: TrackCardProps) {
  return (
    <article className="track-card">
      <img
        src={track.coverUrl ? `${apiBaseUrl}${track.coverUrl}` : "https://placehold.co/300x220?text=GoldenSound"}
        alt={track.title}
        className="track-card__cover"
      />
      <div className="track-card__body">
        <h3>{track.title}</h3>
        <p>{track.authorName}</p>
        <p className="muted">{track.genre.name}</p>
        <div className="track-card__meta">
          <span>
            {track.price.toFixed(2)} {"\u20BD"}
          </span>
          <span>{"\u2605"} {track.averageRating.toFixed(1)}</span>
        </div>
        <div className="track-card__actions">
          <button className="btn" onClick={() => onAdd(track)}>
            Добавить в корзину
          </button>
          <Link className="btn btn--ghost" to={`/tracks/${track.id}`}>
            Подробнее
          </Link>
        </div>
      </div>
    </article>
  );
}

