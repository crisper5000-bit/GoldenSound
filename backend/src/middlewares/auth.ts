import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { verifyAccessToken } from "../utils/auth.js";
import { HttpError } from "../utils/http-error.js";

function extractToken(req: Request): string | null {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    return null;
  }
  return raw.slice(7);
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    next();
    return;
  }

  const payload = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, role: true, username: true, isBlocked: true }
  });

  if (user) {
    req.authUser = user;
  }

  next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  await optionalAuth(req, _res, () => undefined);

  if (!req.authUser) {
    throw new HttpError(401, "Authentication required");
  }

  if (req.authUser.isBlocked) {
    throw new HttpError(403, "Account is blocked");
  }

  next();
}

export function requireRole(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      throw new HttpError(401, "Authentication required");
    }

    if (!roles.includes(req.authUser.role)) {
      throw new HttpError(403, "Access denied");
    }

    next();
  };
}
