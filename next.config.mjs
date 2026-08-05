/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  async headers() {
    return [
      {
        source: "/api/viewer/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      // FIX: Cache public read-only API responses to reduce DB load.
      {
        source: "/api/subjects/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=60, stale-while-revalidate=120" },
        ],
      },
      {
        source: "/api/medical-library",
        headers: [
          { key: "Cache-Control", value: "public, max-age=120, stale-while-revalidate=300" },
        ],
      },
      {
        source: "/api/ifom-library",
        headers: [
          { key: "Cache-Control", value: "public, max-age=120, stale-while-revalidate=300" },
        ],
      },
    ];
  },
};
export default nextConfig;
