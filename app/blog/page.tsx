import type { Metadata } from 'next';
import { MarketingNav } from '@/components/shared/MarketingNav';
import { MarketingFooter } from '@/components/shared/MarketingFooter';
import { PostCard } from '@/components/blog/PostCard';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Tips, guides, and strategies for print-on-demand social media marketing. Learn how to grow your POD store with AI-powered content.',
  openGraph: {
    title: 'SocialStitch Blog — POD Marketing Tips & Guides',
    description:
      'Tips, guides, and strategies for print-on-demand social media marketing.',
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <>
      <MarketingNav />
      <main className="pt-32 pb-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-12 text-center">
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              The SocialStitch Blog
            </h1>
            <p className="mt-3 text-lg text-slate-500">
              Marketing tips, AI guides, and growth strategies for POD sellers.
            </p>
          </div>

          {posts.length === 0 ? (
            <p className="text-center text-slate-400">Coming soon — check back for our first post!</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {posts.map((post) => (
                <PostCard key={post.slug} {...post} />
              ))}
            </div>
          )}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
