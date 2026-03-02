import "express-async-errors";
import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { adminRouter } from "./routes/admin.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { catalogRouter } from "./routes/catalog.routes.js";
import { libraryRouter } from "./routes/library.routes.js";
import { sellerRouter } from "./routes/seller.routes.js";
import { usersRouter } from "./routes/users.routes.js";

const uploadsPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadsPath, { recursive: true });
const mediaPath = path.resolve(process.cwd(), "media");
fs.mkdirSync(mediaPath, { recursive: true });

export const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.CLIENT_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Range"],
    exposedHeaders: ["Content-Range", "Accept-Ranges", "Content-Length"],
    optionsSuccessStatus: 204,
  }),
);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const staticHeaders = (res: express.Response): void => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
};

app.get("/uploads/:folder/:filename", (req, res, next) => {
  const expectedPath = path.join(uploadsPath, req.params.folder, req.params.filename);
  if (fs.existsSync(expectedPath)) {
    staticHeaders(res);
    res.sendFile(expectedPath);
    return;
  }

  const fallbackPath = path.join(uploadsPath, req.params.filename);
  if (fs.existsSync(fallbackPath)) {
    staticHeaders(res);
    res.sendFile(fallbackPath);
    return;
  }

  next();
});

app.use("/uploads", express.static(uploadsPath, { fallthrough: false, setHeaders: staticHeaders }));
app.use("/media", express.static(mediaPath, { fallthrough: false, setHeaders: staticHeaders }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/cart", cartRouter);
app.use("/api/library", libraryRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
