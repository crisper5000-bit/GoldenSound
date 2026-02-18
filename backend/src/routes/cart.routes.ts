import { TrackStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { logActivity } from "../services/activity.service.js";
import { notifyUser } from "../services/notification.service.js";
import { HttpError } from "../utils/http-error.js";
import { formatZodError } from "../utils/validation.js";

const checkoutSchema = z.object({
  cardNumber: z.string().min(1),
  cardHolder: z.string().min(1),
  expiry: z.string().min(1),
  cvv: z.string().min(1)
});

function mapCartItem(item: {
  id: string;
  track: {
    id: string;
    title: string;
    authorName: string;
    price: unknown;
    coverUrl: string | null;
  };
}) {
  return {
    id: item.id,
    trackId: item.track.id,
    title: item.track.title,
    authorName: item.track.authorName,
    price: Number(item.track.price),
    coverUrl: item.track.coverUrl
  };
}

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", async (req, res) => {
  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.authUser!.id },
    include: {
      track: {
        select: {
          id: true,
          title: true,
          authorName: true,
          price: true,
          coverUrl: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const items = cartItems.map(mapCartItem);
  const total = items.reduce((sum, item) => sum + item.price, 0);

  res.json({ items, total });
});

cartRouter.post("/items", async (req, res) => {
  const schema = z.object({ trackId: z.string().cuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const track = await prisma.track.findFirst({
    where: {
      id: parsed.data.trackId,
      status: TrackStatus.APPROVED
    }
  });

  if (!track) {
    throw new HttpError(404, "Track not found");
  }

  await prisma.cartItem.upsert({
    where: {
      userId_trackId: {
        userId: req.authUser!.id,
        trackId: track.id
      }
    },
    create: {
      userId: req.authUser!.id,
      trackId: track.id
    },
    update: {}
  });

  await logActivity({
    action: "ADD_TO_CART",
    entityType: "Track",
    entityId: track.id,
    userId: req.authUser!.id
  });

  res.status(201).json({ message: "Track added to cart" });
});

cartRouter.delete("/items/:trackId", async (req, res) => {
  await prisma.cartItem.deleteMany({
    where: {
      userId: req.authUser!.id,
      trackId: req.params.trackId
    }
  });

  res.json({ message: "Item removed" });
});

cartRouter.post("/checkout", async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: req.authUser!.id },
    include: {
      track: {
        select: {
          id: true,
          status: true,
          price: true
        }
      }
    }
  });

  if (cartItems.length === 0) {
    throw new HttpError(400, "Cart is empty");
  }

  const validItems = cartItems.filter((item) => item.track.status === TrackStatus.APPROVED);
  if (validItems.length === 0) {
    throw new HttpError(400, "No available tracks for purchase");
  }

  const total = validItems.reduce((sum, item) => sum + Number(item.track.price), 0);

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId: req.authUser!.id,
        total
      }
    });

    await tx.orderItem.createMany({
      data: validItems.map((item) => ({
        orderId: order.id,
        trackId: item.track.id,
        price: item.track.price
      }))
    });

    await tx.libraryItem.createMany({
      data: validItems.map((item) => ({
        userId: req.authUser!.id,
        trackId: item.track.id,
        sourceOrder: order.id
      })),
      skipDuplicates: true
    });

    await tx.cartItem.deleteMany({
      where: { userId: req.authUser!.id }
    });

    return order;
  });

  await logActivity({
    action: "CHECKOUT",
    entityType: "Order",
    entityId: result.id,
    userId: req.authUser!.id,
    details: { total }
  });

  await notifyUser(req.authUser!.id, "Покупка успешно завершена. Треки добавлены в медиатеку", {
    orderId: result.id,
    total,
    targetPath: "/library"
  });

  res.json({
    message: "Purchase completed",
    orderId: result.id
  });
});


