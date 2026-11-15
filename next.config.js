/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El proyecto no incluye ESLint: así el build de Vercel no se detiene por ello
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
