import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { wsHub } from "../ws/hub.js";

export interface NotificationMetadata {
  targetPath?: string;
  [key: string]: unknown;
}

export async function notifyUser(userId: string, message: string, metadata?: NotificationMetadata): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      message,
      metadata: metadata as Prisma.InputJsonValue | undefined
    }
  });

  wsHub.sendToUser(userId, {
    type: "notification",
    payload: {
      id: notification.id,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      metadata: notification.metadata as NotificationMetadata | undefined
    }
  });
}

export async function notifyRole(role: UserRole, message: string, metadata?: NotificationMetadata): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role, isBlocked: false },
    select: { id: true }
  });

  await Promise.all(users.map((user) => notifyUser(user.id, message, metadata)));
}
