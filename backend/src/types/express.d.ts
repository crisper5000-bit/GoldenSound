import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        role: UserRole;
        username: string;
        isBlocked: boolean;
      };
    }
  }
}

export {};
