import { ModerationStatus, ModerationType, TrackStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { logActivity } from "../services/activity.service.js";
import { clearCatalogCache } from "../services/cache.service.js";
import { notifyUser } from "../services/notification.service.js";
import { HttpError } from "../utils/http-error.js";
import { formatZodError } from "../utils/validation.js";

const moderationDecisionSchema = z.object({
  note: z.string().max(400).optional()
});

const genreSchema = z.object({
  name: z.string().min(2).max(60)
});

async function applyTrackModerationApproval(
  requestId: string,
  adminId: string,
  note?: string
): Promise<{ trackId: string | null; sellerId: string; type: ModerationType }> {
  const request = await prisma.trackModerationRequest.findFirst({
    where: {
      id: requestId,
      status: ModerationStatus.PENDING
    },
    include: {
      track: true
    }
  });

  if (!request) {
    throw new HttpError(404, "Moderation request not found");
  }

  await prisma.$transaction(async (tx) => {
    if (request.type === ModerationType.TRACK_CREATE) {
      if (!request.trackId) {
        throw new HttpError(400, "Track not linked to moderation request");
      }

      await tx.track.update({
        where: { id: request.trackId },
        data: {
          status: TrackStatus.APPROVED,
          publishedAt: new Date()
        }
      });
    }

    if (request.type === ModerationType.TRACK_UPDATE) {
      if (!request.trackId) {
        throw new HttpError(400, "Track not linked to moderation request");
      }

      const payload = request.payload as Record<string, unknown>;
      const data: Record<string, unknown> = {
        status: TrackStatus.APPROVED,
        publishedAt: new Date()
      };

      if (typeof payload.title === "string") data.title = payload.title;
      if (typeof payload.description === "string") data.description = payload.description;
      if (typeof payload.authorName === "string") data.authorName = payload.authorName;
      if (typeof payload.genreId === "string") data.genreId = payload.genreId;
      if (typeof payload.mediaUrl === "string") data.mediaUrl = payload.mediaUrl;
      if (typeof payload.coverUrl === "string") data.coverUrl = payload.coverUrl;
      if (typeof payload.price === "number") data.price = payload.price;

      await tx.track.update({
        where: { id: request.trackId },
        data
      });
    }

    if (request.type === ModerationType.TRACK_DELETE) {
      if (!request.trackId) {
        throw new HttpError(400, "Track not linked to moderation request");
      }

      await tx.track.update({
        where: { id: request.trackId },
        data: { status: TrackStatus.ARCHIVED }
      });
    }

    await tx.trackModerationRequest.update({
      where: { id: request.id },
      data: {
        status: ModerationStatus.APPROVED,
        note,
        moderatorId: adminId
      }
    });
  });

  return {
    trackId: request.trackId,
    sellerId: request.sellerId,
    type: request.type
  };
}

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole([UserRole.ADMIN]));

adminRouter.get("/moderation/tracks", async (_req, res) => {
  const requests = await prisma.trackModerationRequest.findMany({
    where: { status: ModerationStatus.PENDING },
    include: {
      seller: {
        select: {
          id: true,
          username: true,
          email: true
        }
      },
      track: {
        select: {
          id: true,
          title: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  res.json({ requests });
});

adminRouter.post("/moderation/tracks/:id/approve", async (req, res) => {
  const parsed = moderationDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const result = await applyTrackModerationApproval(req.params.id, req.authUser!.id, parsed.data.note);
  await clearCatalogCache();

  await notifyUser(result.sellerId, "Ваш запрос на модерацию трека одобрен", {
    moderationRequestId: req.params.id,
    trackId: result.trackId,
    targetPath: "/seller"
  });

  await logActivity({
    action: "ADMIN_APPROVE_TRACK_MODERATION",
    entityType: "TrackModerationRequest",
    entityId: req.params.id,
    userId: req.authUser!.id
  });

  res.json({ message: "Request approved" });
});

adminRouter.post("/moderation/tracks/:id/reject", async (req, res) => {
  const parsed = moderationDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const request = await prisma.trackModerationRequest.findFirst({
    where: {
      id: req.params.id,
      status: ModerationStatus.PENDING
    }
  });

  if (!request) {
    throw new HttpError(404, "Moderation request not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.trackModerationRequest.update({
      where: { id: request.id },
      data: {
        status: ModerationStatus.REJECTED,
        note: parsed.data.note,
        moderatorId: req.authUser!.id
      }
    });

    if (request.type === ModerationType.TRACK_CREATE && request.trackId) {
      await tx.track.update({
        where: { id: request.trackId },
        data: { status: TrackStatus.REJECTED }
      });
    }
  });

  await notifyUser(request.sellerId, "Ваш запрос на модерацию трека отклонён", {
    moderationRequestId: request.id,
    note: parsed.data.note,
    targetPath: "/seller"
  });

  await logActivity({
    action: "ADMIN_REJECT_TRACK_MODERATION",
    entityType: "TrackModerationRequest",
    entityId: req.params.id,
    userId: req.authUser!.id
  });

  res.json({ message: "Request rejected" });
});

adminRouter.get("/moderation/reviews", async (_req, res) => {
  const reviews = await prisma.trackReview.findMany({
    where: { status: ModerationStatus.PENDING },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true
        }
      },
      track: {
        select: {
          id: true,
          title: true,
          sellerId: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  res.json({ reviews });
});

adminRouter.post("/moderation/reviews/:id/approve", async (req, res) => {
  const parsed = moderationDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const review = await prisma.trackReview.update({
    where: { id: req.params.id },
    data: {
      status: ModerationStatus.APPROVED,
      moderatedById: req.authUser!.id,
      moderationNote: parsed.data.note
    },
    include: {
      track: {
        select: {
          sellerId: true,
          title: true
        }
      }
    }
  });

  await clearCatalogCache();

  await notifyUser(review.userId, `Ваш отзыв к треку «${review.track.title}» одобрен`, {
    targetPath: `/tracks/${review.trackId}`
  });
  await notifyUser(review.track.sellerId, `Новый одобренный отзыв к треку «${review.track.title}»`, {
    targetPath: "/seller"
  });

  res.json({ message: "Review approved" });
});

adminRouter.post("/moderation/reviews/:id/reject", async (req, res) => {
  const parsed = moderationDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const review = await prisma.trackReview.update({
    where: { id: req.params.id },
    data: {
      status: ModerationStatus.REJECTED,
      moderatedById: req.authUser!.id,
      moderationNote: parsed.data.note
    }
  });

  await notifyUser(review.userId, "Ваш отзыв отклонён модератором", {
    note: parsed.data.note,
    targetPath: `/tracks/${review.trackId}`
  });

  res.json({ message: "Review rejected" });
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      isBlocked: true,
      createdAt: true
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({ users });
});

adminRouter.post("/users/:id/block", async (req, res) => {
  if (req.params.id === req.authUser!.id) {
    throw new HttpError(400, "You cannot block yourself");
  }

  await prisma.user.update({
    where: { id: req.params.id },
    data: { isBlocked: true }
  });

  await logActivity({
    action: "ADMIN_BLOCK_USER",
    entityType: "User",
    entityId: req.params.id,
    userId: req.authUser!.id
  });

  res.json({ message: "User blocked" });
});

adminRouter.post("/users/:id/unblock", async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { isBlocked: false }
  });

  await logActivity({
    action: "ADMIN_UNBLOCK_USER",
    entityType: "User",
    entityId: req.params.id,
    userId: req.authUser!.id
  });

  res.json({ message: "User unblocked" });
});

adminRouter.get("/genres", async (_req, res) => {
  const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });
  res.json({ genres });
});

adminRouter.post("/genres", async (req, res) => {
  const parsed = genreSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const genre = await prisma.genre.create({
    data: { name: parsed.data.name }
  });

  await clearCatalogCache();
  res.status(201).json({ genre });
});

adminRouter.patch("/genres/:id", async (req, res) => {
  const parsed = genreSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const genre = await prisma.genre.update({
    where: { id: req.params.id },
    data: { name: parsed.data.name }
  });

  await clearCatalogCache();
  res.json({ genre });
});

adminRouter.delete("/genres/:id", async (req, res) => {
  const linkedTracks = await prisma.track.count({ where: { genreId: req.params.id } });
  if (linkedTracks > 0) {
    throw new HttpError(400, "Cannot delete genre with linked tracks");
  }

  await prisma.genre.delete({ where: { id: req.params.id } });
  await clearCatalogCache();

  res.json({ message: "Genre deleted" });
});

adminRouter.get("/reports/sales", async (_req, res) => {
  const orders = await prisma.order.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true
        }
      },
      items: {
        include: {
          track: {
            select: {
              id: true,
              title: true,
              seller: {
                select: {
                  id: true,
                  username: true,
                  email: true
                }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);

  res.json({
    totalOrders: orders.length,
    totalRevenue,
    orders: orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      total: Number(order.total),
      buyer: order.user,
      items: order.items.map((item) => ({
        trackId: item.track.id,
        title: item.track.title,
        price: Number(item.price),
        seller: item.track.seller
      }))
    }))
  });
});

adminRouter.get("/reports/activity", async (_req, res) => {
  const logs = await prisma.activityLog.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 300
  });

  res.json({ logs });
});

