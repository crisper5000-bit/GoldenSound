import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middlewares/auth.js";
import { upload } from "../middlewares/upload.js";
import { validateBody } from "../middlewares/validate.js";
import { logActivity } from "../services/activity.service.js";
import { comparePassword, hashPassword } from "../utils/auth.js";
import { HttpError } from "../utils/http-error.js";
import { formatZodError } from "../utils/validation.js";

const profileSchema = z.object({
  username: z.string().min(2).max(40)
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6).max(64),
  newPassword: z.string().min(6).max(64)
});

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/profile", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.authUser!.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      avatarUrl: true,
      createdAt: true
    }
  });

  res.json({ user });
});

usersRouter.patch("/profile", upload.single("avatar"), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, formatZodError(parsed.error));
  }

  const avatarUrl = req.file ? `/uploads/avatars/${path.basename(req.file.path)}` : undefined;

  const user = await prisma.user.update({
    where: { id: req.authUser!.id },
    data: {
      username: parsed.data.username,
      ...(avatarUrl ? { avatarUrl } : {})
    },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      avatarUrl: true
    }
  });

  await logActivity({
    action: "UPDATE_PROFILE",
    entityType: "User",
    entityId: user.id,
    userId: user.id
  });

  res.json({ user });
});

usersRouter.patch("/password", validateBody(passwordSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.authUser!.id },
    select: { id: true, passwordHash: true }
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  const isValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new HttpError(400, "Current password is wrong");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) }
  });

  await logActivity({
    action: "UPDATE_PASSWORD",
    entityType: "User",
    entityId: user.id,
    userId: user.id
  });

  res.json({ message: "Password updated" });
});

usersRouter.get("/notifications", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.authUser!.id },
    orderBy: { createdAt: "desc" },
    take: 30
  });

  res.json({ notifications });
});

usersRouter.patch("/notifications/:id/read", async (req, res) => {
  const notification = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.authUser!.id },
    data: { isRead: true }
  });

  if (notification.count === 0) {
    throw new HttpError(404, "Notification not found");
  }

  res.json({ message: "Notification marked as read" });
});

usersRouter.patch("/notifications/read-all", async (req, res) => {
  await prisma.notification.updateMany({
    where: {
      userId: req.authUser!.id,
      isRead: false
    },
    data: { isRead: true }
  });

  res.json({ message: "All notifications marked as read" });
});


