import type { Metadata, Viewport } from 'next';
import { DM_Sans, Lora } from 'next/font/google';
import './globals.css';

const sans = DM_Sans({ variable: '--font-sans', subsets: ['latin'] });
const serif = Lora({ variable: '--font-serif', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Progressed Pédago — L’atelier pédagogique des formateurs',
  description: 'Créez, animez, imprimez et suivez des cours et activités pédagogiques avec votre propre intelligence artificielle.',
  openGraph: {
    title: 'Progressed Pédago',
    description: 'Une idée ou un PDF devient un cours vivant.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Progressed Pédago — Une idée ou un PDF devient un cours vivant.' }],
  },
  twitter: { card: 'summary_large_image', title: 'Progressed Pédago', description: 'Une idée ou un PDF devient un cours vivant.', images: ['/og.png'] },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/progressed-pedago-book-v2-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/progressed-pedago-book-v2-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Progressed Pédago', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#0b3b33', colorScheme: 'light' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
