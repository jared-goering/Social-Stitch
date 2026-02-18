import Link from 'next/link';
import { Shirt } from 'lucide-react';

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
                <Shirt className="h-4 w-4 text-white" />
              </div>
              <span className="font-display text-lg font-bold text-slate-900">
                Social<span className="text-brand-600">Stitch</span>
              </span>
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">
              AI-powered social media content for print-on-demand sellers. Turn
              flat mockups into stunning lifestyle photos and auto-post everywhere.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Product
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/#how-it-works" className="hover:text-brand-600 transition">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/app" className="hover:text-brand-600 transition">
                  Web App
                </Link>
              </li>
              <li>
                <a
                  href="https://apps.shopify.com/socialstitch"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-brand-600 transition"
                >
                  Shopify App
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Resources
            </h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/blog" className="hover:text-brand-600 transition">
                  Blog
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} SocialStitch. Built by a POD seller, for
          POD sellers.
        </div>
      </div>
    </footer>
  );
}
