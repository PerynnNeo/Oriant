/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === "production";

/* Marketing hardening (spec §13). The CSP allows exactly what the landing
   page needs: self-hosted assets (next/font bundles Google fonts locally),
   inline styles/scripts from Next hydration and framer-motion, data: images
   for inline SVG noise. Dev adds eval + websockets for HMR only. Google
   font hosts stay listed for internal product-mode use of /demo. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data:",
  // Landing product-demo video is hosted on Bunny CDN.
  "media-src 'self' https://oriant-media-storage.b-cdn.net",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep the Next.js default (false) — no browser source maps in production.
  productionBrowserSourceMaps: false,
  // `npm run dev` uses .next; `npm run build` / `npm start` use .next-build
  // (see scripts/next-prod.mjs). Separate directories mean a production build
  // can never overwrite the running dev server's chunks — the cause of
  // "__webpack_modules__[moduleId] is not a function".
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
