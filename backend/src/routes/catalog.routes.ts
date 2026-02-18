import { ModerationStatus, TrackStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { redis } from "../db/redis.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.js";
import { logActivity } from "../services/activity.service.js";
import { clearCatalogCache } from "../services/cache.service.js";
import { notifyRole } from "../services/notification.service.js";
import { HttpError } from "../utils/http-error.js";
import { formatZodError } from "../utils/validation.js";

const trackListQuery = z.object({
  search: z.string().optional(),
  genre: z.string().optional(),
  author: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sort: z.enum(["price_asc", "price_desc", "date_desc", "rating_desc"]).default("date_desc")
});

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(3).max(500)
});

function toPrice(value: unknown): number {
  return Number(value);
}

export const catalogRouter = Router();

catalogRouter.get("/genres", async (_req, res) => {
  const genres = await prisma.genre.findMany({
    orderBy: { name: "asc" }
  });

  res.json({ genres });
});

catalogRouter.get("/tracks", async (req, res) => {
  const query = trackListQuery.parse(req.query);
  const cacheKey = `catalog:${JSON.stringify(query)}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    res.json(JSON.parse(cached));
    return;
  }

  const where = {
    status: TrackStatus.APPROVED,
    ...(query.search
      ? {
          OR: [
            { title: { contains: query.search, mode: "insensitive" as const } },
            { description: { contains: query.search, mode: "insensitive" as const } }
          ]
        }
      : {}),
    ...(query.genre
      ? {
          genre: {
            OR: [
              { id: query.genre },
              { name: { contains: query.genre, mode: "insensitive" as const } }
            ]
          }
        }
      : {}),
    ...(query.author
      ? { authorName: { contains: query.author, mode: "insensitive" as const } }
      : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          price: {
            ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
            ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {})
          }
        }
      : {})
  };

  const orderBy =
    query.sort === "price_asc"
      ? { price: "asc" as const }
      : query.sort === "price_desc"
        ? { price: "desc" as const }
        : { createdAt: "desc" as const };

  const tracks = await prisma.track.findMany({
    where,
    orderBy,
    include: {
      genre: true,
      reviews: {
        where: { status: ModerationStatus.APPROVED },
        select: { rating: true }
      }
    }
  });

  const data = tracks
    .map((track) => {
      const ratingSum = track.reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = track.reviews.length ? ratingSum / track.reviews.length : 0;

      return {
        id: track.id,
        title: track.title,
        authorName: track.authorName,
        genre: track.genre,
        price: toPrice(track.price),
        coverUrl: track.coverUrl,
        createdAt: track.createdAt,
        averageRating,
        ratingCount: track.reviews.length
      };
    })
    .sort((a, b) => {
      if (query.sort === "rating_desc") {
        return b.averageRating - a.averageRating;
      }
      return 0;
    });

  const payload = { tracks: data };
  await redis.set(cacheKey, JSON.stringify(payload), "EX", 60);

  res.json(payload);
});

catalogRouter.get("/tracks/:id", optionalAuth, async (req, res) => {
  const trackId = String(req.params.id);
  const track = await prisma.track.findFirst({
    where: {
      id: trackId,
      status: TrackStatus.APPROVED
    },
    include: {
      genre: true,
      reviews: {
        where: { status: ModerationStatus.APPROVED },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatarUrl: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!track) {
    throw new HttpError(404, "Track not found");
  }

  const ratingSum = track.reviews.reduce((sum, review) => sum + review.rating, 0);

  res.json({
    track: {
      id: track.id,
      title: track.title,
      description: track.description,
      authorName: track.authorName,
      genre: track.genre,
      price: toPrice(track.price),
      mediaUrl: track.mediaUrl,
      coverUrl: track.coverUrl,
      createdAt: track.createdAt,
      averageRating: track.reviews.length ? ratingSum / track.reviews.length : 0,
      reviews: track.reviews
    }
  });
});

catalogRouter.post("/tracks/:id/reviews", requireAuth, async (req, res) => {
  const trackId = String(req.params.id);
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const track = await prisma.track.findFirst({
    where: {
      id: trackId,
      status: TrackStatus.APPROVED
    }
  });

  if (!track) {
    throw new HttpError(404, "Track not found");
  }

  const review = await prisma.trackReview.upsert({
    where: {
      trackId_userId: {
        trackId: track.id,
        userId: req.authUser!.id
      }
    },
    create: {
      trackId: track.id,
      userId: req.authUser!.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      status: ModerationStatus.PENDING
    },
    update: {
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      status: ModerationStatus.PENDING,
      moderationNote: null,
      moderatedById: null
    }
  });

  await clearCatalogCache();

  await notifyRole(UserRole.ADMIN, `Новый отзыв к треку «${track.title}» ожидает модерации`, {
    reviewId: review.id,
    trackId: track.id,
    trackTitle: track.title,
    targetPath: "/admin?tab=reviews"
  });

  await logActivity({
    action: "CREATE_REVIEW",
    entityType: "TrackReview",
    entityId: review.id,
    userId: req.authUser!.id
  });

  res.status(201).json({
    message: "Review submitted for moderation"
  });
});


