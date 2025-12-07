/**
 * Gallery Page
 *
 * Polaris page wrapper for the GalleryView component.
 * Displays previously generated mockups.
 */

import React from 'react';
import { Page, Layout, Banner } from '@shopify/polaris';
import { GalleryView } from '../GalleryView';

interface GalleryPageProps {
  onCreatePost: () => void;
}

export const GalleryPage: React.FC<GalleryPageProps> = ({ onCreatePost }) => {
  return (
    <Page
      title="Mockup Gallery"
      subtitle="Browse and reuse your generated mockups"
      primaryAction={{
        content: 'Create New Post',
        onAction: onCreatePost,
      }}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>
              Click on any mockup to use it for a new social media post. All your
              previously generated mockups are saved here.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <GalleryView onCreatePost={onCreatePost} />
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default GalleryPage;


