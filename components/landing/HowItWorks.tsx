import { Upload, Sparkles, Send } from 'lucide-react';

const steps = [
  {
    icon: Upload,
    step: '01',
    title: 'Upload your design',
    description:
      'Drop in your flat product image or connect your Shopify store to import products automatically.',
    color: 'from-brand-500 to-brand-600',
    bgColor: 'bg-brand-50',
  },
  {
    icon: Sparkles,
    step: '02',
    title: 'AI generates lifestyle photos',
    description:
      'Our AI transforms your flat mockup into stunning, scroll-stopping lifestyle photography in seconds.',
    color: 'from-accent-coral to-pink-600',
    bgColor: 'bg-pink-50',
  },
  {
    icon: Send,
    step: '03',
    title: 'Auto-post everywhere',
    description:
      'Schedule and auto-post to Instagram, Facebook, TikTok, and Pinterest — with AI-written captions.',
    color: 'from-accent-teal to-emerald-600',
    bgColor: 'bg-teal-50',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 md:py-28 bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
            Three steps to{' '}
            <span className="bg-gradient-to-r from-brand-600 to-accent-teal bg-clip-text text-transparent">
              content on autopilot
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            From flat mockup to live social post in under 60 seconds.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="relative text-center">
              {/* Step number */}
              <div className="mx-auto mb-6 relative">
                <div
                  className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-lg`}
                >
                  <item.icon className="h-9 w-9 text-white" />
                </div>
                <span className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900 shadow-md border border-slate-100">
                  {item.step}
                </span>
              </div>

              <h3 className="mb-2 text-xl font-bold text-slate-900">{item.title}</h3>
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
