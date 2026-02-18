import type { Server as HttpServer } from "node:http";
import { UserRole } from "@prisma/client";
import { WebSocket, WebSocketServer } from "ws";
import { prisma } from "../db/prisma.js";
import { verifyAccessToken } from "../utils/auth.js";

interface ClientMeta {
  userId: string;
  role: UserRole;
}

interface SocketMessage {
  type: string;
  payload: Record<string, unknown>;
}

class WsHub {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, ClientMeta>();

  init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", async (socket, request) => {
      try {
        const requestUrl = new URL(request.url ?? "", "http://localhost");
        const token = requestUrl.searchParams.get("token");

        if (!token) {
          socket.close();
          return;
        }

        const payload = verifyAccessToken(token);
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, role: true }
        });

        if (!user) {
          socket.close();
          return;
        }

        this.clients.set(socket, { userId: user.id, role: user.role });

        socket.on("close", () => {
          this.clients.delete(socket);
        });
      } catch {
        socket.close();
      }
    });
  }

  sendToUser(userId: string, message: SocketMessage): void {
    for (const [socket, meta] of this.clients.entries()) {
      if (meta.userId === userId && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    }
  }

  sendToRole(role: UserRole, message: SocketMessage): void {
    for (const [socket, meta] of this.clients.entries()) {
      if (meta.role === role && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    }
  }
}

export const wsHub = new WsHub();
