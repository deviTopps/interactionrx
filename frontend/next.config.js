/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  // /api/* is handled by app/api/[...path]/route.ts (runtime proxy to BACKEND_URL)
};

module.exports = nextConfig;
