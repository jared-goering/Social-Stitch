import { Check, X, Minus } from 'lucide-react';

const features = [
  { name: 'AI lifestyle image generation', ss: true, photo: true, social: false },
  { name: 'Auto-post to social platforms', ss: true, photo: false, social: true },
  { name: 'AI caption generation', ss: true, photo: false, social: 'partial' },
  { name: 'Content calendar & scheduling', ss: true, photo: false, social: true },
  { name: 'Shopify integration', ss: true, photo: false, social: 'partial' },
  { name: 'Built for print on demand', ss: true, photo: false, social: false },
  { name: 'Upload → Post in one workflow', ss: true, photo: false, social: false },
];

function CellIcon({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check className="h-5 w-5 text-emerald-500" />;
  if (value === 'partial')
    return <Minus className="h-5 w-5 text-amber-400" />;
  return <X className="h-5 w-5 text-slate-300" />;
}

export function Comparison() {
  return (
    <section className="py-20 md:py-28 bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-4xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Other apps generate photos <em className="text-brand-600">or</em>{' '}
            post to social.{' '}
            <span className="bg-gradient-to-r from-brand-600 to-accent-teal bg-clip-text text-transparent">
              We do both.
            </span>
          </h2>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-left font-semibold text-slate-600">Feature</th>
                <th className="px-4 py-4 text-center">
                  <span className="font-bold text-brand-700">SocialStitch</span>
                </th>
                <th className="px-4 py-4 text-center font-medium text-slate-500">
                  Photo-Only Apps
                </th>
                <th className="px-4 py-4 text-center font-medium text-slate-500">
                  Social-Only Apps
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr
                  key={f.name}
                  className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}
                >
                  <td className="px-6 py-3.5 text-slate-700 font-medium">{f.name}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex justify-center">
                      <CellIcon value={f.ss} />
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex justify-center">
                      <CellIcon value={f.photo} />
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex justify-center">
                      <CellIcon value={f.social} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
