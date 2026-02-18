import { Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { optionalAuth, requireAuth } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { logActivity } from "../services/activity.service.js";
import { comparePassword, hashPassword, signAccessToken } from "../utils/auth.js";
import { HttpError } from "../utils/http-error.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(64),
  username: z.string().min(2).max(40),
  role: z.enum([UserRole.USER, UserRole.SELLER]).default(UserRole.USER)
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1)
});

function toUserDto(user: {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    avatarUrl: user.avatarUrl
  };
}

export const authRouter = Router();

authRouter.post("/register", validateBody(registerSchema), async (req, res) => {
  const { email, password, username, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "Email already exists");
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      passwordHash: await hashPassword(password),
      role
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
    action: "REGISTER",
    entityType: "User",
    entityId: user.id,
    userId: user.id
  });

  res.status(201).json({
    token: signAccessToken(user.id),
    user: toUserDto(user)
  });
});

authRouter.post("/login", validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      avatarUrl: true,
      passwordHash: true,
      isBlocked: true
    }
  });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new HttpError(401, "Wrong email or password");
  }

  if (user.isBlocked) {
    throw new HttpError(403, "Account is blocked");
  }

  await logActivity({
    action: "LOGIN",
    entityType: "User",
    entityId: user.id,
    userId: user.id
  });

  res.json({
    token: signAccessToken(user.id),
    user: toUserDto(user)
  });
});

authRouter.get("/me", optionalAuth, requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.authUser!.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      avatarUrl: true
    }
  });

  if (!user) {
    throw new HttpError(404, "User not found");
  }

  res.json({ user: toUserDto(user) });
});

authRouter.post("/logout", optionalAuth, async (req, res) => {
  if (req.authUser) {
    await logActivity({
      action: "LOGOUT",
      entityType: "User",
      entityId: req.authUser.id,
      userId: req.authUser.id
    });
  }

  res.json({ message: "Logged out" });
});
