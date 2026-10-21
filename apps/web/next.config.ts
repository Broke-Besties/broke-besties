import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Local dev only: the mobile app's web build (Expo, localhost:8081) calls this API from another origin.
  ...(process.env.NODE_ENV === "development" && {
    async headers() {
      return [
        {
          source: "/api/:path*",
          headers: [
            { key: "Access-Control-Allow-Origin", value: "http://localhost:8081" },
            { key: "Access-Control-Allow-Headers", value: "authorization, content-type" },
            { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
          ],
        },
      ];
    },
  }),
};

export default nextConfig;
