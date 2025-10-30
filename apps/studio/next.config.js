/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bun-compatible Next.js config
  experimental: {
    // Enable if needed
  },
  // Ensure transpilation of workspace packages
  transpilePackages: ["@codalyn/sandbox", "@codalyn/tools", "@codalyn/runtime", "@codalyn/shared"],
};

module.exports = nextConfig;
