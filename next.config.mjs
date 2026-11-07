/** @type {import('next').NextConfig} */

// The API (page storage and the AI assistant) is the FastAPI app in backend/.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    domains: ["placehold.co"],
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
  experimental: {
    // AI requests stream for a while; the default proxy timeout is 30s.
    proxyTimeout: 300_000,
  },
};

export default nextConfig;
