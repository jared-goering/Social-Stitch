/**
 * Products Page
 *
 * Polaris page wrapper for the ProductBrowser component.
 * Displays the merchant's Shopify product catalog.
 */

import React from 'react';
import { Page, Layout, LegacyCard, Text, Banner, Link } from '@shopify/polaris';
import { ProductBrowser } from '../ProductBrowser';
import {
  ShopifyProduct,
  ShopifyProductImage,
} from '../../services/shopifyProductService';

interface ProductsPageProps {
  onSelectProduct: (product: ShopifyProduct) => void;
  onSelectImage: (image: ShopifyProductImage, product: ShopifyProduct) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  onSelectProduct,
  onSelectImage,
}) => {
  return (
    <Page
      title="Products"
      subtitle="Select a product to create social media content"
      primaryAction={{
        content: 'Upload Custom Design',
        url: '#create',
      }}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info" title="Create content from your products">
            <p>
              Select a product image to generate AI mockups and create engaging
              social media posts. You can also{' '}
              <Link url="#create">upload a custom design</Link>.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <ProductBrowser
            onSelectProduct={onSelectProduct}
            onSelectImage={onSelectImage}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default ProductsPage;

