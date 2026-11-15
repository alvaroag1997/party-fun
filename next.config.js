/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El proyecto no incluye ESLint: así el build de Vercel no se detiene por ello
  eslint: { ignoreDuringBuilds: true },
  // La dirección antigua redirige a la nueva
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'party-fun-smoky.vercel.app' }],
        destination: 'https://adivinodromo.vercel.app/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
