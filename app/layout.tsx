import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, JetBrains_Mono, Onest } from 'next/font/google';
import { AuthProvider } from '@/components/auth/AuthContext';
import { Background } from '@/components/chrome/Background';
import { Providers } from '@/components/chrome/Providers';
import { SiteFooter } from '@/components/chrome/SiteFooter';
import { SiteHeader } from '@/components/chrome/SiteHeader';
import { getViewer } from '@/lib/auth';
import { withTimeout } from '@/lib/db';
import { appConfig, authEnabled, installUrl } from '@/lib/githubApp';
import { THEME_BOOT_SCRIPT } from '@/lib/themeScript';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' });
const sans = Onest({ subsets: ['latin'], variable: '--font-onest', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'grepless · search code by meaning',
    template: '%s · grepless',
  },
  description:
    'Paste a public GitHub repo and ask questions like “where do we retry failed auth requests?”. AST chunking, local embeddings and pgvector hybrid search.',
  openGraph: {
    title: 'grepless · search code by meaning',
    description: 'Semantic code search over any public GitHub repository.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#08070e' },
    { media: '(prefers-color-scheme: light)', color: '#f4f2fb' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const enabled = authEnabled();
  const viewer = enabled ? await withTimeout(getViewer(), 4000, null, 'viewer') : null;
  const slug = appConfig()?.slug;
  const auth = {
    enabled,
    viewer: viewer ? { login: viewer.login, name: viewer.name, avatarUrl: viewer.avatarUrl } : null,
    installUrl: slug ? installUrl(slug) : null,
  };

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
        >
          Skip to content
        </a>
        <Providers>
          <AuthProvider value={auth}>
            <Background />
            <SiteHeader />
            {children}
            <SiteFooter />
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
