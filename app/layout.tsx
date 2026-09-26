import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'grepless — search code by meaning',
    template: '%s · grepless',
  },
  description:
    'Paste a public GitHub repo and ask questions like “where do we retry failed auth requests?”. AST chunking, local embeddings and pgvector hybrid search.',
  openGraph: {
    title: 'grepless — search code by meaning',
    description: 'Semantic code search over any public GitHub repository.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0b0d' },
    { media: '(prefers-color-scheme: light)', color: '#fafaf8' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <SiteHeader />
        {children}
        <footer className="mt-24 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>grepless · built by Sayantan-Sinha-GIT</p>
            <p className="font-mono text-xs">gte-small · pgvector HNSW · tree-sitter · Next.js on Vercel</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
