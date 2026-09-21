import dotenv from "dotenv";
import path from "path";
import { defineConfig } from "prisma/config";

// Load environment variables from .env.local, fallback to default .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL || "file:./dev.db",
  },
});
