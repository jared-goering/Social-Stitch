import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { migratePostsToCurrentUser } from './services/scheduledPostsService';

// Expose migration function globally for console access
// Usage: After signing in, open console and run: migratePosts()
(window as unknown as { migratePosts: typeof migratePostsToCurrentUser }).migratePosts = migratePostsToCurrentUser;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);