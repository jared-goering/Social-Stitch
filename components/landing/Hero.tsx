import Link from 'next/link';
import { Sparkles, ArrowRight, Zap } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-accent-coral/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-teal/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
          <Zap className="h-3.5 w-3.5" />
          Built for Shopify POD sellers
        </div>

        {/* Headline */}
        <h1 className="font-display mx-auto max-w-4xl text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl md:text-6xl lg:text-7xl">
          Turn flat product photos into{' '}
          <span className="bg-gradient-to-r from-brand-600 via-accent-coral to-accent-warm bg-clip-text text-transparent animate-gradient">
            scroll-stopping
          </span>{' '}
          social content
        </h1>

        {/* Subhead */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
          The only Shopify app that generates{' '}
          <strong className="text-slate-800">AI lifestyle images</strong> from your
          products <em>and</em> auto-posts them to Instagram, Facebook, TikTok &amp;
          Pinterest.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="https://apps.shopify.com/socialstitch"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-500/25 transition hover:shadow-brand-500/40 hover:brightness-110"
          >
            <Sparkles className="h-4 w-4" />
            Install on Shopify
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </a>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 hover:shadow-md"
          >
            Try the Web App Free
          </Link>
        </div>

        {/* Hero visual placeholder */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="relative rounded-2xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-slate-900/10">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-brand-50 via-white to-accent-coral/5 flex items-center justify-center">
              <div className="text-center">
                <div className="flex items-center justify-center gap-6 mb-4">
                  {/* Before */}
                  <div className="relative">
                    <div className="w-32 h-32 md:w-44 md:h-44 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl md:text-4xl mb-1">👕</div>
                        <span className="text-xs text-slate-400 font-medium">Flat Mockup</span>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex flex-col items-center gap-1">
                    <Sparkles className="h-6 w-6 text-brand-500 animate-float" />
                    <ArrowRight className="h-5 w-5 text-brand-400" />
                    <span className="text-[10px] font-medium text-brand-500">AI Magic</span>
                  </div>

                  {/* After */}
                  <div className="relative">
                    <div className="w-32 h-32 md:w-44 md:h-44 rounded-xl bg-gradient-to-br from-brand-100 to-accent-coral/20 border-2 border-brand-200 flex items-center justify-center shadow-lg shadow-brand-500/10">
                      <div className="text-center">
                        <div className="text-3xl md:text-4xl mb-1">📸</div>
                        <span className="text-xs text-brand-600 font-medium">Lifestyle Photo</span>
                      </div>
                    </div>
                    {/* Social badges */}
                    <div className="absolute -bottom-2 -right-2 flex gap-1">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[10px] shadow-md">📱</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-[10px] shadow-md">📘</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-2">Upload → Generate → Post. That simple.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
