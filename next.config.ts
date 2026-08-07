import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep Turbopack rooted in this app (avoids picking up a parent lockfile).
  turbopack: {
    root,
  },
};

export default nextConfig;
