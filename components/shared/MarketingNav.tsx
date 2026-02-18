import Link from 'next/link';
import { Shirt } from 'lucide-react';

export function MarketingNav() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-500/25">
            <Shirt className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold text-slate-900">
            Social<span className="text-brand-600">Stitch</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-slate-600 transition hover:text-brand-600"
          >
            How It Works
          </Link>
          <Link
            href="/blog"
            className="text-sm font-medium text-slate-600 transition hover:text-brand-600"
          >
            Blog
          </Link>
          <Link
            href="/app"
            className="text-sm font-medium text-slate-600 transition hover:text-brand-600"
          >
            Web App
          </Link>
          <a
            href="https://apps.shopify.com/socialstitch"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-gradient-to-r from-brand-600 to-brand-700 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:shadow-brand-500/40"
          >
            Install on Shopify
          </a>
        </div>
      </div>
    </nav>
  );
}
