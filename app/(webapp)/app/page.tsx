'use client';

import dynamic from 'next/dynamic';

// Dynamically import the existing App component with SSR disabled
// since it relies on browser APIs (window, Firebase Auth, etc.)
const App = dynamic(() => import('@/App'), { ssr: false });

export default function WebAppPage() {
  return <App />;
}
