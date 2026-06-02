import path from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // reactCompiler: true, // requires babel-plugin-react-compiler
  logging: {
    fetches: { fullUrl: false },
    incomingRequests: false,
  },
  images: {
    remotePatterns: [{ hostname: "avatar.vercel.sh" }, { hostname: "img.clerk.com" }],
  },
  // Monorepo: pin the workspace root explicitly (two levels up from packages/web)
  // so Turbopack doesn't have to infer it from lockfile location.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  cacheComponents: true,
  experimental: {
    prefetchInlining: true,
    cachedNavigations: true,
    appNewScrollHandler: true,
    inlineCss: true,
    // turbopackFileSystemCacheForDev intentionally OFF: the experimental Turbopack
    // dev FS cache triggers a process-spawn/OOM storm on Windows (see foreman-5rph).
    preloadEntriesOnStart: false,
  },
};

export default withMDX(nextConfig);
