import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  await initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  images: {
    // Cloudflare Pages does not run Next.js image optimization — serve originals directly
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "qkgakhluqruqoifknprg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
