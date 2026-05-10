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
  cacheComponents: true,
  experimental: {
    prefetchInlining: true,
    cachedNavigations: true,
    appNewScrollHandler: true,
    inlineCss: true,
    turbopackFileSystemCacheForDev: true,
  },
};

export default withMDX(nextConfig);
