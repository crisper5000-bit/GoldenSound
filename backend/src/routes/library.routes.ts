import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { HttpError } from "../utils/http-error.js";
import { formatZodError } from "../utils/validation.js";

const playlistSchema = z.object({
  name: z.string().min(2).max(80)
});

export const libraryRouter = Router();

libraryRouter.use(requireAuth);

libraryRouter.get("/tracks", async (req, res) => {
  const items = await prisma.libraryItem.findMany({
    where: { userId: req.authUser!.id },
    include: {
      track: {
        include: {
          genre: true
        }
      }
    },
    orderBy: { purchasedAt: "desc" }
  });

  res.json({
    tracks: items.map((item) => ({
      purchasedAt: item.purchasedAt,
      orderId: item.sourceOrder,
      track: {
        id: item.track.id,
        title: item.track.title,
        authorName: item.track.authorName,
        mediaUrl: item.track.mediaUrl,
        coverUrl: item.track.coverUrl,
        genre: item.track.genre,
        price: Number(item.track.price)
      }
    }))
  });
});

libraryRouter.get("/orders", async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.authUser!.id },
    include: {
      items: {
        include: {
          track: {
            select: {
              id: true,
              title: true,
              authorName: true,
              coverUrl: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    orders: orders.map((order) => ({
      id: order.id,
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        trackId: item.trackId,
        title: item.track.title,
        authorName: item.track.authorName,
        coverUrl: item.track.coverUrl,
        price: Number(item.price)
      }))
    }))
  });
});

libraryRouter.get("/playlists", async (req, res) => {
  const playlists = await prisma.playlist.findMany({
    where: { userId: req.authUser!.id },
    include: {
      playlistMap: {
        include: {
          track: {
            include: {
              genre: true
            }
          }
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  res.json({
    playlists: playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      tracks: playlist.playlistMap.map((entry) => ({
        id: entry.track.id,
        title: entry.track.title,
        authorName: entry.track.authorName,
        mediaUrl: entry.track.mediaUrl,
        coverUrl: entry.track.coverUrl,
        genre: entry.track.genre,
        price: Number(entry.track.price)
      }))
    }))
  });
});

libraryRouter.post("/playlists", async (req, res) => {
  const parsed = playlistSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const playlist = await prisma.playlist.create({
    data: {
      name: parsed.data.name,
      userId: req.authUser!.id
    }
  });

  res.status(201).json({ playlist });
});

libraryRouter.patch("/playlists/:playlistId", async (req, res) => {
  const parsed = playlistSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const playlist = await prisma.playlist.updateMany({
    where: {
      id: req.params.playlistId,
      userId: req.authUser!.id
    },
    data: { name: parsed.data.name }
  });

  if (!playlist.count) {
    throw new HttpError(404, "Playlist not found");
  }

  res.json({ message: "Playlist updated" });
});

libraryRouter.delete("/playlists/:playlistId", async (req, res) => {
  await prisma.playlist.deleteMany({
    where: {
      id: req.params.playlistId,
      userId: req.authUser!.id
    }
  });

  res.json({ message: "Playlist removed" });
});

libraryRouter.post("/playlists/:playlistId/tracks", async (req, res) => {
  const parsed = z
    .object({ trackId: z.string().cuid() })
    .safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const playlist = await prisma.playlist.findFirst({
    where: {
      id: req.params.playlistId,
      userId: req.authUser!.id
    }
  });

  if (!playlist) {
    throw new HttpError(404, "Playlist not found");
  }

  const ownedTrack = await prisma.libraryItem.findFirst({
    where: {
      userId: req.authUser!.id,
      trackId: parsed.data.trackId
    }
  });

  if (!ownedTrack) {
    throw new HttpError(403, "Track is not in your media library");
  }

  await prisma.playlistTrack.upsert({
    where: {
      playlistId_trackId: {
        playlistId: playlist.id,
        trackId: parsed.data.trackId
      }
    },
    create: {
      playlistId: playlist.id,
      trackId: parsed.data.trackId
    },
    update: {}
  });

  res.status(201).json({ message: "Track added to playlist" });
});

libraryRouter.delete("/playlists/:playlistId/tracks/:trackId", async (req, res) => {
  await prisma.playlistTrack.deleteMany({
    where: {
      playlistId: req.params.playlistId,
      trackId: req.params.trackId,
      playlist: {
        userId: req.authUser!.id
      }
    }
  });

  res.json({ message: "Track removed from playlist" });
});


