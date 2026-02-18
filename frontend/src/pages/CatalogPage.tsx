import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../api/client";
import { TrackCard } from "../components/catalog/TrackCard";
import { CartSidebar } from "../components/cart/CartSidebar";
import { useCart } from "../context";
import type { Genre, TrackCardItem } from "../types";

interface Filters {
  search: string;
  genre: string;
  author: string;
  minPrice: string;
  maxPrice: string;
  sort: "date_desc" | "price_asc" | "price_desc" | "rating_desc";
}

const initialFilters: Filters = {
  search: "",
  genre: "",
  author: "",
  minPrice: "",
  maxPrice: "",
  sort: "date_desc"
};

export function CatalogPage() {
  const [tracks, setTracks] = useState<TrackCardItem[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    void apiRequest<{ genres: Genre[] }>("/catalog/genres").then((response) => setGenres(response.genres));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set("search", filters.search);
    if (filters.genre) params.set("genre", filters.genre);
    if (filters.author) params.set("author", filters.author);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    params.set("sort", filters.sort);

    return params.toString();
  }, [filters]);

  useEffect(() => {
    const fetchTracks = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiRequest<{ tracks: TrackCardItem[] }>(`/catalog/tracks?${queryString}`);
        setTracks(response.tracks);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Ошибка загрузки каталога");
      } finally {
        setLoading(false);
      }
    };

    void fetchTracks();
  }, [queryString]);

  return (
    <div className="catalog-layout">
      <CartSidebar />
      <section className="catalog-content">
        <div className="panel filters">
          <h2>Каталог треков</h2>
          <div className="filters__grid">
            <input
              className="input"
              placeholder="Поиск по названию"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
            <select
              className="input"
              value={filters.genre}
              onChange={(event) => setFilters((prev) => ({ ...prev, genre: event.target.value }))}
            >
              <option value="">Все жанры</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>
                  {genre.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Автор"
              value={filters.author}
              onChange={(event) => setFilters((prev) => ({ ...prev, author: event.target.value }))}
            />
            <input
              className="input"
              type="number"
              min={0}
              step={0.01}
              placeholder="Цена от"
              value={filters.minPrice}
              onChange={(event) => setFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
            />
            <input
              className="input"
              type="number"
              min={0}
              step={0.01}
              placeholder="Цена до"
              value={filters.maxPrice}
              onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
            />
            <select
              className="input"
              value={filters.sort}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  sort: event.target.value as Filters["sort"]
                }))
              }
            >
              <option value="date_desc">Сначала новые</option>
              <option value="price_asc">Цена по возрастанию</option>
              <option value="price_desc">Цена по убыванию</option>
              <option value="rating_desc">По рейтингу</option>
            </select>
          </div>
        </div>

        {loading && <div className="state">Загрузка каталога...</div>}
        {error && <div className="state state--error">{error}</div>}

        <div className="track-grid">
          {tracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onAdd={() =>
                void addToCart({
                  trackId: track.id,
                  title: track.title,
                  authorName: track.authorName,
                  price: track.price,
                  coverUrl: track.coverUrl
                })
              }
            />
          ))}
        </div>
      </section>
    </div>
  );
}
