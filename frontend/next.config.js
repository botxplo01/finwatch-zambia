/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Proxy all /api/* requests to the FastAPI backend during development.
   * In production, set NEXT_PUBLIC_API_URL and call the backend directly.
   */
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/:path*`,
      },
    ];
  },

  reactStrictMode: true,
};

module.exports = nextConfig;
