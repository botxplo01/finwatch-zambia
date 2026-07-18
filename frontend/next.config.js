/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export only for Capacitor/Android builds.
  // Set NEXT_EXPORT=true in the mobile build script before running `npm run build`.
  // During `npm run dev` and standard web deployments this must be unset so that
  // Next.js server features (rewrites, middleware) work correctly.
  ...(process.env.NEXT_EXPORT === "true" && { output: "export" }),
  images: {
    unoptimized: true,
  },
  /**
   * Proxy all /api/* requests to the FastAPI backend during development.
   * In production, set NEXT_PUBLIC_API_URL and call the backend directly.
   */
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [
      {
        source: "/api/:path*",
        destination: `${
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
        }/api/:path*`,
      },
    ];
  },

  reactStrictMode: true,
};

module.exports = nextConfig;
