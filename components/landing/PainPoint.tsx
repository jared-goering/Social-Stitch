import { AlertTriangle, Clock, ImageOff, TrendingDown } from 'lucide-react';

const painPoints = [
  {
    icon: ImageOff,
    title: 'Flat mockups look terrible on social',
    description:
      'White-background product photos get scrolled past in 0.3 seconds. They were made for listings, not feeds.',
  },
  {
    icon: Clock,
    title: 'No time for 200+ products',
    description:
      'Creating unique lifestyle content for every product? That\'s weeks of work. Or thousands in photographer fees.',
  },
  {
    icon: TrendingDown,
    title: 'Manual posting is unsustainable',
    description:
      'Copy-pasting across 4 platforms, crafting captions, scheduling times… you started a store, not a media company.',
  },
];

export function PainPoint() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sound familiar?
          </div>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            You have 200 products and{' '}
            <span className="text-accent-coral">zero social content</span>
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Every POD seller hits the same wall. Great designs, no way to market
            them at scale.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {painPoints.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:shadow-md hover:border-slate-300"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-slate-900">{item.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
