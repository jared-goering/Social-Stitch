import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';

export function CTAFooter() {
  return (
    <section className="relative overflow-hidden py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900" />
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-30">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-accent-coral/30 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent-teal/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
          Ready to automate your social content?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-200">
          Stop spending hours on content creation. Let AI do the heavy lifting
          while you focus on growing your business.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://apps.shopify.com/socialstitch"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand-700 shadow-xl transition hover:shadow-2xl hover:brightness-105"
          >
            <Sparkles className="h-4 w-4" />
            Install on Shopify
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
          >
            Try Free on Web
          </Link>
        </div>
      </div>
    </section>
  );
}
