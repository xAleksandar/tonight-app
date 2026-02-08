import type { NextConfig } from "next";

// Ensure Prisma uses the binary engine in all environments. The `.env` value for
// PRISMA_CLIENT_ENGINE_TYPE may not be picked up if Next.js selects a different
// workspace root, so we set it here as a fallback.
const nextConfig: NextConfig = {
  env: {
    PRISMA_CLIENT_ENGINE_TYPE: "binary",
  },
};

export default nextConfig;
