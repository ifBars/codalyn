/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bun-compatible Next.js config
  experimental: {
    // Enable if needed
  },
  // Ensure transpilation of workspace packages
  transpilePackages: ["@codalyn/sandbox", "@codalyn/tools", "@codalyn/runtime", "@codalyn/shared"],

  // Configure response headers for WebContainer support
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: blob:",
              "frame-src 'self' https://*.webcontainer.io https://*.webcontainer-api.io https://stackblitz.com https://*.stackblitz.com",
              "child-src 'self' blob:",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
