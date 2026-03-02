import path from "node:path";
import { env } from "../config/env.js";

const uploadsRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

export function toUploadsUrl(filePath: string): string {
  const relative = path.relative(uploadsRoot, filePath);
  const normalized = relative.split(path.sep).join("/");
  return `/uploads/${normalized}`;
}
