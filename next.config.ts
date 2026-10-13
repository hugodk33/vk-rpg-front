import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/:path*",
      },
      {
        /* Uploaded/generated images live on the API disk; the browser
           loads them from the same origin, so proxy them too. */
        source: "/uploads/:path*",
        destination: "http://localhost:3000/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
