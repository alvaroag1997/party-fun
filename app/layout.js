import './globals.css';

export const metadata = {
  title: 'Party Fun',
  description: 'Juego de fiesta de 3 rondas con un solo móvil: describe, una palabra y mímica.',
  manifest: '/manifest.json',
  applicationName: 'Party Fun',
  appleWebApp: {
    capable: true,
    title: 'Party Fun',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
