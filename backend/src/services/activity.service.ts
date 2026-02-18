import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

interface ActivityInput {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  details?: Record<string, unknown>;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  await prisma.activityLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
      details: input.details as Prisma.InputJsonValue | undefined
    }
  });
}
