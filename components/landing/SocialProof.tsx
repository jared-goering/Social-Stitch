import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah M.',
    role: 'Etsy & Shopify Seller',
    quote:
      'I used to spend hours creating social content for my POD store. SocialStitch does it in seconds. My engagement is up 3x.',
    avatar: '👩‍🎨',
  },
  {
    name: 'Marcus T.',
    role: 'Print on Demand Brand Owner',
    quote:
      'The AI lifestyle images look better than photos I paid photographers hundreds of dollars to take. Game changer.',
    avatar: '👨‍💼',
  },
  {
    name: 'Priya K.',
    role: 'Shopify Store Owner',
    quote:
      'Upload, generate, schedule. That\'s it. I added 50 products to my social calendar in one afternoon.',
    avatar: '👩‍💻',
  },
];

export function SocialProof() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-600">
            Trusted by POD sellers
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Built by a POD seller,{' '}
            <span className="text-brand-600">for POD sellers</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="relative rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <Quote className="absolute top-6 right-6 h-8 w-8 text-brand-100" />
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="mb-6 text-sm leading-relaxed text-slate-600">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-xl">
                  {t.avatar}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
