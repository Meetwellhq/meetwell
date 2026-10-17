import type { NextConfig } from "next";

// Lets phones on the same Wi-Fi load the dev server when NEXT_PUBLIC_SITE_URL
// is set to this computer's network address (for testing QR scans locally).
const siteHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  allowedDevOrigins: siteHost && siteHost !== "localhost" ? [siteHost] : [],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
