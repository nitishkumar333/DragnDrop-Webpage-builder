/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    domains: ["placehold.co"],
  },
  experimental: {
    // Load the Claude SDK from node_modules at runtime instead of bundling it;
    // Next 14.1's server minifier breaks a regular expression inside it.
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
};

export default nextConfig;
