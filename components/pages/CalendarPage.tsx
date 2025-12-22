/**
 * Calendar Page
 *
 * Polaris page wrapper for the CalendarView component.
 * Displays scheduled posts in a calendar format.
 */

import React from 'react';
import { Page, Layout, Banner } from '@shopify/polaris';
import { CalendarView } from '../Calendar';

interface CalendarPageProps {
  onCreatePost: () => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({ onCreatePost }) => {
  return (
    <Page
      title="Content Calendar"
      subtitle="View and manage your scheduled social media posts"
      primaryAction={{
        content: 'Create New Post',
        onAction: onCreatePost,
      }}
    >
      <Layout>
        <Layout.Section>
          <CalendarView onCreatePost={onCreatePost} />
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default CalendarPage;




