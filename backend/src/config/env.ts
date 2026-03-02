import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  UPLOAD_DIR: z.string().default("uploads"),
  CLIENT_ORIGINS: z.string().default("http://localhost:5173"),
});

const rawEnv = schema.parse(process.env);
const clientOrigins = rawEnv.CLIENT_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean);
const validatedOrigins = z.array(z.string().url()).parse(clientOrigins);

export const env = {
  ...rawEnv,
  CLIENT_ORIGINS: validatedOrigins,
};
