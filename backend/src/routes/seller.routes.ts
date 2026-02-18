import path from "node:path";
import { ModerationStatus, ModerationType, TrackStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { upload } from "../middlewares/upload.js";
import { logActivity } from "../services/activity.service.js";
import { clearCatalogCache } from "../services/cache.service.js";
import { notifyRole } from "../services/notification.service.js";
import { HttpError } from "../utils/http-error.js";
import { formatZodError } from "../utils/validation.js";

const createTrackSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(1500),
  genreId: z.string().cuid(),
  price: z.coerce.number().min(0.5).max(9999),
  authorName: z.string().min(2).max(120).optional()
});

const updateTrackSchema = createTrackSchema.partial().refine(
  (data) =>
    data.title !== undefined ||
    data.description !== undefined ||
    data.genreId !== undefined ||
    data.price !== undefined ||
    data.authorName !== undefined,
  {
    message: "At least one field is required"
  }
);

export const sellerRouter = Router();

sellerRouter.use(requireAuth, requireRole([UserRole.SELLER]));

sellerRouter.get("/tracks", async (req, res) => {
  const tracks = await prisma.track.findMany({
    where: { sellerId: req.authUser!.id },
    include: {
      genre: true,
      reviews: {
        where: { status: ModerationStatus.APPROVED },
        select: { rating: true }
      },
      moderationRequests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          type: true,
          status: true,
          note: true,
          createdAt: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const salesAgg = await prisma.orderItem.groupBy({
    by: ["trackId"],
    where: {
      track: {
        sellerId: req.authUser!.id
      }
    },
    _count: {
      _all: true
    }
  });

  const salesMap = new Map(salesAgg.map((item) => [item.trackId, item._count._all]));

  res.json({
    tracks: tracks.map((track) => {
      const ratingTotal = track.reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = track.reviews.length ? ratingTotal / track.reviews.length : 0;

      return {
        id: track.id,
        title: track.title,
        description: track.description,
        authorName: track.authorName,
        price: Number(track.price),
        genre: track.genre,
        mediaUrl: track.mediaUrl,
        coverUrl: track.coverUrl,
        status: track.status,
        createdAt: track.createdAt,
        salesCount: salesMap.get(track.id) ?? 0,
        averageRating,
        latestModeration: track.moderationRequests[0] ?? null
      };
    })
  });
});

sellerRouter.get("/dashboard", async (req, res) => {
  const tracks = await prisma.track.findMany({
    where: { sellerId: req.authUser!.id },
    include: {
      reviews: {
        where: { status: ModerationStatus.APPROVED },
        include: {
          user: {
            select: { id: true, username: true }
          }
        }
      }
    }
  });

  const sales = await prisma.orderItem.groupBy({
    by: ["trackId"],
    where: {
      track: {
        sellerId: req.authUser!.id
      }
    },
    _count: { _all: true },
    _sum: { price: true }
  });

  const salesMap = new Map<string, { count: number; revenue: number }>(
    sales.map((item) => [
      item.trackId,
      {
        count: item._count._all,
        revenue: Number(item._sum.price ?? 0)
      }
    ])
  );

  res.json({
    tracks: tracks.map((track) => ({
      id: track.id,
      title: track.title,
      status: track.status,
      salesCount: salesMap.get(track.id)?.count ?? 0,
      revenue: salesMap.get(track.id)?.revenue ?? 0,
      averageRating: track.reviews.length
        ? track.reviews.reduce((sum, review) => sum + review.rating, 0) / track.reviews.length
        : 0,
      reviews: track.reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        author: review.user.username,
        createdAt: review.createdAt
      }))
    }))
  });
});

sellerRouter.post(
  "/tracks",
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "cover", maxCount: 1 }
  ]),
  async (req, res) => {
    const parsed = createTrackSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, formatZodError(parsed.error));
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const mediaFile = files?.media?.[0];
    const coverFile = files?.cover?.[0];

    if (!mediaFile) {
      throw new HttpError(400, "Track media file is required");
    }

    const genre = await prisma.genre.findUnique({
      where: { id: parsed.data.genreId }
    });

    if (!genre) {
      throw new HttpError(404, "Genre not found");
    }

    const track = await prisma.track.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        authorName: parsed.data.authorName ?? req.authUser!.username,
        genreId: parsed.data.genreId,
        price: parsed.data.price,
        mediaUrl: `/uploads/tracks/${path.basename(mediaFile.path)}`,
        coverUrl: coverFile ? `/uploads/covers/${path.basename(coverFile.path)}` : null,
        sellerId: req.authUser!.id,
        status: TrackStatus.PENDING
      }
    });

    const moderation = await prisma.trackModerationRequest.create({
      data: {
        type: ModerationType.TRACK_CREATE,
        trackId: track.id,
        sellerId: req.authUser!.id,
        payload: {
          title: track.title,
          description: track.description,
          authorName: track.authorName,
          genreId: track.genreId,
          price: Number(track.price),
          mediaUrl: track.mediaUrl,
          coverUrl: track.coverUrl
        }
      }
    });

    await clearCatalogCache();

    await notifyRole(UserRole.ADMIN, `Новый трек «${track.title}» отправлен на модерацию`, {
      moderationId: moderation.id,
      trackId: track.id,
      title: track.title,
      targetPath: "/admin?tab=tracks"
    });

    await logActivity({
      action: "SELLER_CREATE_TRACK",
      entityType: "Track",
      entityId: track.id,
      userId: req.authUser!.id
    });

    res.status(201).json({
      message: "Track sent to moderation",
      trackId: track.id
    });
  }
);

sellerRouter.patch(
  "/tracks/:trackId",
  upload.fields([
    { name: "media", maxCount: 1 },
    { name: "cover", maxCount: 1 }
  ]),
  async (req, res) => {
    const trackId = String(req.params.trackId);
    const parsed = updateTrackSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, formatZodError(parsed.error));
    }

    const track = await prisma.track.findFirst({
      where: {
        id: trackId,
        sellerId: req.authUser!.id,
        status: {
          not: TrackStatus.ARCHIVED
        }
      }
    });

    if (!track) {
      throw new HttpError(404, "Track not found");
    }

    if (parsed.data.genreId) {
      const genre = await prisma.genre.findUnique({ where: { id: parsed.data.genreId } });
      if (!genre) {
        throw new HttpError(404, "Genre not found");
      }
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const mediaFile = files?.media?.[0];
    const coverFile = files?.cover?.[0];

    const moderation = await prisma.trackModerationRequest.create({
      data: {
        type: ModerationType.TRACK_UPDATE,
        trackId: track.id,
        sellerId: req.authUser!.id,
        payload: {
          ...parsed.data,
          ...(mediaFile ? { mediaUrl: `/uploads/tracks/${path.basename(mediaFile.path)}` } : {}),
          ...(coverFile ? { coverUrl: `/uploads/covers/${path.basename(coverFile.path)}` } : {})
        }
      }
    });

    await notifyRole(UserRole.ADMIN, `Изменения трека «${track.title}» ожидают модерации`, {
      moderationId: moderation.id,
      trackId: track.id,
      title: track.title,
      targetPath: "/admin?tab=tracks"
    });

    await logActivity({
      action: "SELLER_UPDATE_TRACK_REQUEST",
      entityType: "Track",
      entityId: track.id,
      userId: req.authUser!.id
    });

    res.json({ message: "Track update sent to moderation" });
  }
);

sellerRouter.delete("/tracks/:trackId", async (req, res) => {
  const trackId = String(req.params.trackId);
  const track = await prisma.track.findFirst({
    where: {
      id: trackId,
      sellerId: req.authUser!.id,
      status: { not: TrackStatus.ARCHIVED }
    }
  });

  if (!track) {
    throw new HttpError(404, "Track not found");
  }

  const moderation = await prisma.trackModerationRequest.create({
    data: {
      type: ModerationType.TRACK_DELETE,
      trackId: track.id,
      sellerId: req.authUser!.id,
      payload: {
        id: track.id,
        title: track.title
      }
    }
  });

  await notifyRole(UserRole.ADMIN, `Запрос на удаление трека «${track.title}» ожидает модерации`, {
    moderationId: moderation.id,
    trackId: track.id,
    title: track.title,
    targetPath: "/admin?tab=tracks"
  });

  await logActivity({
    action: "SELLER_DELETE_TRACK_REQUEST",
    entityType: "Track",
    entityId: track.id,
    userId: req.authUser!.id
  });

  res.json({ message: "Track deletion request sent to moderation" });
});


