export type UserRole = "USER" | "SELLER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatarUrl?: string | null;
}

export interface Genre {
  id: string;
  name: string;
}

export interface TrackCardItem {
  id: string;
  title: string;
  authorName: string;
  price: number;
  coverUrl?: string | null;
  averageRating: number;
  ratingCount: number;
  createdAt: string;
  genre: Genre;
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
}

export interface TrackDetails {
  id: string;
  title: string;
  description: string;
  authorName: string;
  price: number;
  mediaUrl: string;
  coverUrl?: string | null;
  createdAt: string;
  averageRating: number;
  genre: Genre;
  reviews: Review[];
}

export interface CartItem {
  trackId: string;
  title: string;
  authorName: string;
  price: number;
  coverUrl?: string | null;
}

export interface LibraryTrack {
  purchasedAt: string;
  orderId: string;
  track: {
    id: string;
    title: string;
    authorName: string;
    mediaUrl: string;
    coverUrl?: string | null;
    genre: Genre;
    price: number;
  };
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Array<{
    id: string;
    title: string;
    authorName: string;
    mediaUrl: string;
    coverUrl?: string | null;
    genre: Genre;
    price: number;
  }>;
}

export interface WsNotification {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    targetPath?: string;
    [key: string]: unknown;
  };
}
