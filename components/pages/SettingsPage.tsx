/**
 * Settings Page
 *
 * Polaris page for app settings and account management.
 */

import React from 'react';
import {
  Page,
  Layout,
  LegacyCard,
  Text,
  Banner,
  List,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Box,
} from '@shopify/polaris';
import { useShopifyContext } from '../ShopifyProvider';

interface SettingsPageProps {
  onNavigateToCreate?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigateToCreate }) => {
  const { shop, isAuthenticated } = useShopifyContext();

  return (
    <Page title="Settings" subtitle="Manage your SocialStitch app settings">
      <Layout>
        {/* Shop Information */}
        <Layout.Section>
          <LegacyCard title="Shop Information" sectioned>
            <BlockStack gap="400">
              <InlineStack gap="200" align="start">
                <Text as="span" fontWeight="semibold">
                  Shop Domain:
                </Text>
                <Text as="span">{shop || 'Not connected'}</Text>
              </InlineStack>
              <InlineStack gap="200" align="start">
                <Text as="span" fontWeight="semibold">
                  Status:
                </Text>
                {isAuthenticated ? (
                  <Badge tone="success">Connected</Badge>
                ) : (
                  <Badge tone="critical">Not Connected</Badge>
                )}
              </InlineStack>
            </BlockStack>
          </LegacyCard>
        </Layout.Section>

        {/* Social Media Connections */}
        <Layout.Section>
          <LegacyCard title="Social Media Accounts" sectioned>
            <BlockStack gap="400">
              <Text as="p" tone="subdued">
                Social media account connections are managed during the post
                creation workflow. Connect your Facebook and Instagram accounts
                when you create your first post.
              </Text>
              {onNavigateToCreate && (
                <Box>
                  <Button onClick={onNavigateToCreate}>
                    Create a Post
                  </Button>
                </Box>
              )}
            </BlockStack>
          </LegacyCard>
        </Layout.Section>

        {/* Features */}
        <Layout.Section>
          <LegacyCard title="Available Features" sectioned>
            <List>
              <List.Item>
                <Text as="span" fontWeight="semibold">
                  Product Import
                </Text>
                {' - '}Select products from your Shopify store for content creation
              </List.Item>
              <List.Item>
                <Text as="span" fontWeight="semibold">
                  AI Mockups
                </Text>
                {' - '}Generate professional lifestyle photos with AI
              </List.Item>
              <List.Item>
                <Text as="span" fontWeight="semibold">
                  AI Captions
                </Text>
                {' - '}Create engaging social media captions automatically
              </List.Item>
              <List.Item>
                <Text as="span" fontWeight="semibold">
                  Social Scheduling
                </Text>
                {' - '}Schedule posts to Facebook and Instagram
              </List.Item>
              <List.Item>
                <Text as="span" fontWeight="semibold">
                  Content Calendar
                </Text>
                {' - '}View and manage all your scheduled posts
              </List.Item>
            </List>
          </LegacyCard>
        </Layout.Section>

        {/* Support */}
        <Layout.Section>
          <LegacyCard title="Support" sectioned>
            <BlockStack gap="400">
              <Text as="p" tone="subdued">
                Need help? Contact our support team or check out the documentation.
              </Text>
              <InlineStack gap="200">
                <Button url="mailto:support@socialstitch.app" external>
                  Contact Support
                </Button>
                <Button url="https://docs.socialstitch.app" external plain>
                  Documentation
                </Button>
              </InlineStack>
            </BlockStack>
          </LegacyCard>
        </Layout.Section>

        {/* Privacy & Data */}
        <Layout.Section>
          <Banner tone="info" title="Privacy & Data">
            <p>
              SocialStitch stores your generated mockups and scheduled posts to
              provide the best experience. You can delete your data at any time
              by uninstalling the app. See our{' '}
              <a
                href="https://socialstitch.app/privacy"
                target="_blank"
                rel="noopener noreferrer"
              >
                Privacy Policy
              </a>{' '}
              for more details.
            </p>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default SettingsPage;

