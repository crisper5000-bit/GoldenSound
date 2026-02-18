import * as Avatar from "@radix-ui/react-avatar";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMemo, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { apiBaseUrl } from "../../api/client";
import { useAuth } from "../../context";
import type { WsNotification } from "../../types";

function getNotificationTarget(notification: WsNotification): string | null {
  if (!notification.metadata?.targetPath) {
    return null;
  }

  return typeof notification.metadata.targetPath === "string" ? notification.metadata.targetPath : null;
}

export function Header() {
  const { user, logout, notifications, markNotificationRead, markAllNotificationsRead } = useAuth();
  const navigate = useNavigate();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  return (
    <header className="header">
      <div className="header__left">
        <Link className="logo" to="/">
          GoldenSound
        </Link>

        <nav className="nav">
          <NavLink to="/" className="nav__link">
            Каталог
          </NavLink>
          <NavLink to={user ? "/library" : "/login?redirect=/library"} className="nav__link">
            Медиатека
          </NavLink>
          <NavLink to={user ? "/playlists" : "/login?redirect=/playlists"} className="nav__link">
            Плейлисты
          </NavLink>
        </nav>
      </div>

      <div className="header__right">
        {user && (
          <DropdownMenu.Root
            open={isNotificationsOpen}
            onOpenChange={(open) => {
              setIsNotificationsOpen(open);
              if (open && unreadCount > 0) {
                void markAllNotificationsRead();
              }
            }}
          >
            <DropdownMenu.Trigger className="btn btn--ghost">
              Уведомления ({unreadCount})
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="menu" sideOffset={8}>
              {notifications.length === 0 && <div className="menu__item">Новых уведомлений нет</div>}
              {notifications.slice(0, 8).map((notification) => (
                <DropdownMenu.Item
                  key={notification.id}
                  className="menu__item"
                  onSelect={() => {
                    void markNotificationRead(notification.id);
                    const targetPath = getNotificationTarget(notification);
                    if (targetPath) {
                      navigate(targetPath);
                    }
                  }}
                >
                  <div>{notification.message}</div>
                  <div className="muted">{new Date(notification.createdAt).toLocaleString()}</div>
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}

        {!user && (
          <button className="btn" onClick={() => navigate("/login")}>
            Вход
          </button>
        )}

        {user && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="profile-trigger">
              <Avatar.Root className="avatar">
                <Avatar.Image
                  className="avatar__image"
                  src={user.avatarUrl ? `${apiBaseUrl}${user.avatarUrl}` : undefined}
                  alt={user.username}
                />
                <Avatar.Fallback className="avatar__fallback">
                  {user.username.slice(0, 1).toUpperCase()}
                </Avatar.Fallback>
              </Avatar.Root>
              <span>{user.username}</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="menu" sideOffset={8} align="end">
              <DropdownMenu.Item className="menu__item" onSelect={() => navigate("/profile")}>
                Личный кабинет
              </DropdownMenu.Item>
              {user.role === "SELLER" && (
                <DropdownMenu.Item className="menu__item" onSelect={() => navigate("/seller")}>
                  Бизнес кабинет
                </DropdownMenu.Item>
              )}
              {user.role === "ADMIN" && (
                <DropdownMenu.Item className="menu__item" onSelect={() => navigate("/admin?tab=tracks")}>
                  Модерация
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                className="menu__item"
                onSelect={async () => {
                  await logout();
                  navigate("/");
                }}
              >
                Выйти
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        )}
      </div>
    </header>
  );
}
