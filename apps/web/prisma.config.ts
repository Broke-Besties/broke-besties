import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "npx tsx ./prisma/seed.ts",
  },
  // Use process.env instead of env() helper for optional environment variables
  // This prevents errors during prisma generate when env vars aren't loaded yet
  ...(process.env.DIRECT_URL && {
    datasource: {
      url: process.env.DIRECT_URL,
    },
  }),
});
