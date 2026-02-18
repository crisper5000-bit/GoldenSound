import { useEffect, useState } from "react";
import { apiBaseUrl, apiRequest } from "../api/client";
import { useAuth } from "../context";
import type { User } from "../types";

export function ProfilePage() {
  const { token, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      const response = await apiRequest<{ user: User }>("/users/profile", { token });
      setProfile(response.user);
      setUsername(response.user.username);
    };

    void load();
  }, [token]);

  const updateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const formData = new FormData();
    formData.append("username", username);
    if (avatar) {
      formData.append("avatar", avatar);
    }

    await apiRequest<{ user: User }>("/users/profile", {
      method: "PATCH",
      token,
      body: formData
    });

    await refreshProfile();
    setMessage("Профиль обновлен");
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    await apiRequest("/users/password", {
      method: "PATCH",
      token,
      body: {
        currentPassword,
        newPassword
      }
    });

    setCurrentPassword("");
    setNewPassword("");
    setMessage("Пароль обновлен");
  };

  return (
    <section className="panel profile-page">
      <h1>Личный кабинет</h1>
      {message && <p className="state">{message}</p>}
      <div className="profile-grid">
        <div className="panel">
          <h2>Данные аккаунта</h2>
          <img
            className="profile-avatar"
            src={
              profile?.avatarUrl
                ? `${apiBaseUrl}${profile.avatarUrl}`
                : "https://placehold.co/180x180?text=Avatar"
            }
            alt={profile?.username}
          />
          <form className="form" onSubmit={updateProfile}>
            <label>
              Email
              <input className="input" value={profile?.email ?? ""} disabled />
            </label>
            <label>
              Имя пользователя
              <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label>
              Аватар
              <input className="input" type="file" accept="image/*" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} />
            </label>
            <button className="btn" type="submit">
              Сохранить
            </button>
          </form>
        </div>

        <div className="panel">
          <h2>Смена пароля</h2>
          <form className="form" onSubmit={updatePassword}>
            <label>
              Текущий пароль
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label>
              Новый пароль
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <button className="btn" type="submit">
              Обновить пароль
            </button>
          </form>

        </div>
      </div>
    </section>
  );
}
