import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';

interface PostCardProps {
  slug: string;
  title: string;
  description: string;
  date: string;
  readTime: string;
  tags: string[];
}

export function PostCard({ slug, title, description, date, readTime, tags }: PostCardProps) {
  return (
    <Link
      href={`/blog/${slug}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md hover:border-brand-200"
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-600"
          >
            {tag}
          </span>
        ))}
      </div>
      <h3 className="mb-2 text-lg font-bold text-slate-900 transition group-hover:text-brand-600">
        {title}
      </h3>
      <p className="mb-4 text-sm leading-relaxed text-slate-500 line-clamp-2">
        {description}
      </p>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span>{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {readTime}
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-brand-400 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
