import { ArrowRight } from 'lucide-react';

const examples = [
  { label: 'Mountain T-Shirt', emoji: '🏔️' },
  { label: 'Retro Sunset Hoodie', emoji: '🌅' },
  { label: 'Floral Tote Bag', emoji: '🌸' },
  { label: 'Cat Dad Mug', emoji: '🐱' },
];

export function BeforeAfter() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            See the{' '}
            <span className="bg-gradient-to-r from-brand-600 to-accent-coral bg-clip-text text-transparent">
              transformation
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            Flat mockup in, lifestyle content out. Every time.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {examples.map((ex) => (
            <div
              key={ex.label}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg hover:border-brand-200"
            >
              {/* Before */}
              <div className="mb-3 flex aspect-square items-center justify-center rounded-xl bg-slate-100 border-2 border-dashed border-slate-200">
                <div className="text-center">
                  <span className="text-4xl">{ex.emoji}</span>
                  <p className="mt-1 text-[10px] font-medium text-slate-400">BEFORE</p>
                </div>
              </div>

              <div className="flex items-center justify-center py-1">
                <ArrowRight className="h-4 w-4 text-brand-400 rotate-90" />
              </div>

              {/* After */}
              <div className="flex aspect-square items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-accent-coral/10 border-2 border-brand-100">
                <div className="text-center">
                  <span className="text-4xl">{ex.emoji}</span>
                  <p className="mt-1 text-[10px] font-medium text-brand-500">AFTER — AI LIFESTYLE</p>
                </div>
              </div>

              <p className="mt-3 text-center text-sm font-semibold text-slate-700">
                {ex.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
