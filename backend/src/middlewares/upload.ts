import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { env } from "../config/env.js";

function ensureFolder(folder: string): string {
  const full = path.resolve(process.cwd(), env.UPLOAD_DIR, folder);
  fs.mkdirSync(full, { recursive: true });
  return full;
}

const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === "avatar") {
      cb(null, ensureFolder("avatars"));
      return;
    }

    if (file.fieldname === "cover") {
      cb(null, ensureFolder("covers"));
      return;
    }

    cb(null, ensureFolder("tracks"));
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${timestamp}-${safe}`);
  }
});

export const upload = multer({ storage });
