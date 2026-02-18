import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketingNav } from '@/components/shared/MarketingNav';
import { MarketingFooter } from '@/components/shared/MarketingFooter';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      images: post.image ? [{ url: post.image }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Simple MDX-like rendering: convert markdown-ish content to HTML
  // For a full MDX pipeline, we'd use next-mdx-remote, but for now
  // we render the content as formatted text
  const contentHtml = post.content
    .split('\n')
    .map((line) => {
      if (line.startsWith('## '))
        return `<h2 class="mt-10 mb-4 text-2xl font-bold text-slate-900">${line.slice(3)}</h2>`;
      if (line.startsWith('### '))
        return `<h3 class="mt-8 mb-3 text-xl font-semibold text-slate-900">${line.slice(4)}</h3>`;
      if (line.startsWith('- '))
        return `<li class="ml-4 text-slate-600">${line.slice(2)}</li>`;
      if (line.trim() === '') return '<br />';
      return `<p class="mb-4 text-base leading-relaxed text-slate-600">${line}</p>`;
    })
    .join('\n');

  return (
    <>
      <MarketingNav />
      <main className="pt-32 pb-20">
        <article className="mx-auto max-w-3xl px-6">
          <Link
            href="/blog"
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          <header className="mb-10">
            <div className="mb-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">
              {post.title}
            </h1>
            <div className="mt-4 flex items-center gap-4 text-sm text-slate-400">
              <span>
                {new Date(post.date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {post.readTime}
              </span>
            </div>
          </header>

          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />

          {/* CTA Banner */}
          <div className="mt-16 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-8 text-center text-white">
            <h3 className="text-xl font-bold">Ready to try SocialStitch?</h3>
            <p className="mt-2 text-brand-200">
              Turn your flat product photos into scroll-stopping social content.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="https://apps.shopify.com/socialstitch"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-brand-700 transition hover:brightness-105"
              >
                Install on Shopify
              </a>
              <Link
                href="/app"
                className="rounded-full border border-white/30 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Try Free on Web
              </Link>
            </div>
          </div>

          {/* JSON-LD */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.description,
                datePublished: post.date,
                author: {
                  '@type': 'Organization',
                  name: 'SocialStitch',
                },
                publisher: {
                  '@type': 'Organization',
                  name: 'SocialStitch',
                  url: 'https://socialstitch.io',
                },
              }),
            }}
          />
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}
