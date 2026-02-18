import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiBaseUrl, apiRequest } from "../api/client";
import { useAuth } from "../context";
import type { LibraryTrack, Playlist } from "../types";

export function PlaylistsPage() {
  const { token } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [libraryTracks, setLibraryTracks] = useState<LibraryTrack[]>([]);
  const [playlistName, setPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!token) return;

    const [playlistsResponse, tracksResponse] = await Promise.all([
      apiRequest<{ playlists: Playlist[] }>("/library/playlists", { token }),
      apiRequest<{ tracks: LibraryTrack[] }>("/library/tracks", { token })
    ]);

    setPlaylists(playlistsResponse.playlists);
    setLibraryTracks(tracksResponse.tracks);
    setRenameMap(
      Object.fromEntries(playlistsResponse.playlists.map((playlist) => [playlist.id, playlist.name]))
    );

    if (!selectedPlaylistId && playlistsResponse.playlists[0]) {
      setSelectedPlaylistId(playlistsResponse.playlists[0].id);
    }
    if (!selectedTrackId && tracksResponse.tracks[0]) {
      setSelectedTrackId(tracksResponse.tracks[0].track.id);
    }
  };

  useEffect(() => {
    void loadData();
  }, [token]);

  const canAddTrack = useMemo(
    () => Boolean(selectedPlaylistId && selectedTrackId),
    [selectedPlaylistId, selectedTrackId]
  );

  const createPlaylist = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !playlistName.trim()) return;

    setError(null);
    await apiRequest("/library/playlists", {
      method: "POST",
      token,
      body: { name: playlistName }
    });

    setPlaylistName("");
    setMessage("Плейлист создан");
    await loadData();
  };

  const renamePlaylist = async (playlistId: string) => {
    if (!token) return;
    const nextName = renameMap[playlistId]?.trim();
    if (!nextName) return;

    setError(null);
    await apiRequest(`/library/playlists/${playlistId}`, {
      method: "PATCH",
      token,
      body: { name: nextName }
    });

    setMessage("Название плейлиста обновлено");
    await loadData();
  };

  const removePlaylist = async (playlistId: string) => {
    if (!token) return;

    setError(null);
    await apiRequest(`/library/playlists/${playlistId}`, {
      method: "DELETE",
      token
    });

    setMessage("Плейлист удалён");
    await loadData();
  };

  const addTrackToPlaylist = async () => {
    if (!token || !canAddTrack) return;

    setError(null);
    await apiRequest(`/library/playlists/${selectedPlaylistId}/tracks`, {
      method: "POST",
      token,
      body: { trackId: selectedTrackId }
    });

    setMessage("Трек добавлен в плейлист");
    await loadData();
  };

  const removeTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    if (!token) return;

    setError(null);
    await apiRequest(`/library/playlists/${playlistId}/tracks/${trackId}`, {
      method: "DELETE",
      token
    });

    setMessage("Трек удалён из плейлиста");
    await loadData();
  };

  return (
    <section className="panel">
      <h1>Плейлисты</h1>
      {message && <p className="state">{message}</p>}
      {error && <p className="state state--error">{error}</p>}

      <div className="library-grid">
        <div className="panel">
          <h2>Создание и редактирование</h2>
          <form className="form" onSubmit={createPlaylist}>
            <input
              className="input"
              placeholder="Название нового плейлиста"
              value={playlistName}
              onChange={(event) => setPlaylistName(event.target.value)}
            />
            <button className="btn" type="submit">
              Создать плейлист
            </button>
          </form>

          <div className="form">
            <select
              className="input"
              value={selectedPlaylistId}
              onChange={(event) => setSelectedPlaylistId(event.target.value)}
            >
              <option value="">Выберите плейлист</option>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>
                  {playlist.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={selectedTrackId}
              onChange={(event) => setSelectedTrackId(event.target.value)}
            >
              <option value="">Выберите трек</option>
              {libraryTracks.map((item) => (
                <option key={item.track.id} value={item.track.id}>
                  {item.track.title}
                </option>
              ))}
            </select>
            <button className="btn" type="button" disabled={!canAddTrack} onClick={() => void addTrackToPlaylist()}>
              Добавить трек в плейлист
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Ваши плейлисты</h2>
          {playlists.length === 0 && <p className="muted">Пока нет плейлистов</p>}
          {playlists.map((playlist) => (
            <article className="playlist-card" key={playlist.id}>
              <div className="row gap-sm">
                <input
                  className="input"
                  value={renameMap[playlist.id] ?? playlist.name}
                  onChange={(event) =>
                    setRenameMap((prev) => ({
                      ...prev,
                      [playlist.id]: event.target.value
                    }))
                  }
                />
                <button className="btn" type="button" onClick={() => void renamePlaylist(playlist.id)}>
                  Сохранить
                </button>
                <button className="btn btn--danger" type="button" onClick={() => void removePlaylist(playlist.id)}>
                  Удалить
                </button>
              </div>

              {playlist.tracks.length === 0 && <p className="muted">Плейлист пуст</p>}
              {playlist.tracks.map((track) => (
                <div className="playlist-track" key={`${playlist.id}-${track.id}`}>
                  <div className="row row--between">
                    <p>
                      {track.title} · {track.authorName}
                    </p>
                    <button
                      className="btn-link"
                      type="button"
                      onClick={() => void removeTrackFromPlaylist(playlist.id, track.id)}
                    >
                      Удалить трек
                    </button>
                  </div>
                  <audio controls src={`${apiBaseUrl}${track.mediaUrl}`} />
                </div>
              ))}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
