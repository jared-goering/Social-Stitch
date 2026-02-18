import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'SocialStitch — AI Social Content for Print on Demand',
    template: '%s | SocialStitch',
  },
  description:
    'Turn flat product photos into scroll-stopping social content. The only Shopify app that generates AI lifestyle images AND auto-posts to Instagram, Facebook, TikTok & Pinterest.',
  metadataBase: new URL('https://socialstitch.io'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://socialstitch.io',
    siteName: 'SocialStitch',
    title: 'SocialStitch — AI Social Content for Print on Demand',
    description:
      'Turn flat product photos into scroll-stopping social content. AI lifestyle images + auto-posting for Shopify POD sellers.',
    images: [{ url: '/og/home.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SocialStitch — AI Social Content for Print on Demand',
    description:
      'Turn flat product photos into scroll-stopping social content.',
    images: ['/og/home.png'],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'SocialStitch',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              url: 'https://socialstitch.io',
              description:
                'AI-powered social media content generator for print-on-demand sellers.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
            }),
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
