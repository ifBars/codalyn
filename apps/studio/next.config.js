/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bun-compatible Next.js config
  experimental: {
    // Enable if needed
  },
  // Ensure transpilation of workspace packages
  transpilePackages: ["@codalyn/sandbox", "@codalyn/tools", "@codalyn/runtime", "@codalyn/shared"],

  // Configure response headers for OAuth compatibility
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self'; object-src 'none';",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
