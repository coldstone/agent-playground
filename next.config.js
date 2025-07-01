/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker builds
  output: 'standalone',
  // No experimental features needed for Next.js 14
}

module.exports = nextConfig
