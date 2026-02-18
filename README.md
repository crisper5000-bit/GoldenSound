# GoldenSound

GoldenSound is a fullstack diploma project: an online music store with roles, moderation, media library, playlists, cart and fake checkout flow.

## Stack

- Frontend: React, Vite, TypeScript, Radix UI, WebSocket client
- Backend: Node.js, Express, TypeScript, PostgreSQL, Prisma, Redis, WebSocket
- Infrastructure: Docker, Docker Compose

## Project structure

```text
GoldenSound/
  backend/
    prisma/
    src/
  frontend/
    src/
  docker-compose.yml
```

## Roles and access

- Guest: catalog browse, add to cart (local cart), auth required for checkout/media library
- User: guest features + profile, checkout, media library, playlists, reviews and ratings
- Seller: user features + business cabinet (create/edit/delete track requests with moderation)
- Admin: user features + moderation panel (tracks/reviews/users/genres/reports)

## Main implemented features

- Catalog with search, sorting, filtering by genre/author/price
- Track card + details page with comments and 5-star rating flow
- Auth and registration with role choice (USER/SELLER)
- Profile editing (username, password, avatar upload)
- Seller cabinet for track management and sales statistics
- Admin moderation for tracks and reviews
- Admin user blocking, genre CRUD, sales/activity reports
- Cart and fake card checkout
- Purchased tracks in media library
- Playlist creation and management from purchased tracks
- WebSocket notifications (moderation/events)

## Run locally (frontend/backend on host, DB + Redis in Docker)

1. Start infrastructure:

```bash
docker compose up -d postgres redis
```

2. Prepare env files:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

3. Install dependencies and prepare database:

```bash
npm install
npm run prisma:generate --workspace backend
npm run prisma:push --workspace backend
npm run prisma:seed --workspace backend
```

4. Start app:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080/api`

## Run fully in Docker

```bash
docker compose up --build
```

This starts `postgres`, `redis`, `backend`, `frontend`.

## Demo credentials

- Admin: `admin` / `admin`
- Seller: `seller@goldensound.dev` / `seller123`
- User: `user@goldensound.dev` / `user123`

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/catalog/genres`, `GET /api/catalog/tracks`, `GET /api/catalog/tracks/:id`
- `POST /api/catalog/tracks/:id/reviews`
- `GET /api/cart`, `POST /api/cart/items`, `POST /api/cart/checkout`
- `GET /api/library/tracks`, `GET /api/library/orders`, playlists CRUD
- `GET /api/seller/tracks`, `GET /api/seller/dashboard`, seller track moderation requests
- `GET /api/admin/moderation/*`, `GET /api/admin/users`, `GET /api/admin/reports/*`
