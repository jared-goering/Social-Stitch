import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SocialStitch App',
  description: 'Generate AI lifestyle images and schedule social media posts for your products.',
};

export default function WebAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* The existing app uses Tailwind CDN classes via runtime */}
      <script src="https://cdn.tailwindcss.com" />
      {children}
    </>
  );
}
