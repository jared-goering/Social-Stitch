/**
 * Create Page
 *
 * Polaris page wrapper for the content creation workflow.
 * Includes upload, mockup generation, and caption review steps.
 */

import React from 'react';
import { Page, Layout, LegacyCard, Banner, Link, Badge } from '@shopify/polaris';
import { UploadSection } from '../UploadSection';
import { MockupGenerator } from '../MockupGenerator';
import { CaptionReview } from '../CaptionReview';
import { StepIndicator } from '../StepIndicator';
import { AppStep, UploadedDesign, MockupOption } from '../../types';

interface CreatePageProps {
  currentStep: AppStep;
  design: UploadedDesign | null;
  selectedMockups: MockupOption[];
  onUpload: (design: UploadedDesign) => void;
  onMockupsSelected: (mockups: MockupOption[]) => void;
  onSuccess: () => void;
  onScheduled: () => void;
  onStepClick: (step: AppStep) => void;
  onReset: () => void;
  onNavigateToProducts: () => void;
}

export const CreatePage: React.FC<CreatePageProps> = ({
  currentStep,
  design,
  selectedMockups,
  onUpload,
  onMockupsSelected,
  onSuccess,
  onScheduled,
  onStepClick,
  onReset,
  onNavigateToProducts,
}) => {
  const getPageTitle = () => {
    switch (currentStep) {
      case AppStep.UPLOAD:
        return 'Create Post';
      case AppStep.MOCKUP_GENERATION:
        return 'Generate Mockups';
      case AppStep.CAPTIONING:
        return 'Add Captions';
      case AppStep.SUCCESS:
        return 'Success!';
      default:
        return 'Create Post';
    }
  };

  const getPageSubtitle = () => {
    switch (currentStep) {
      case AppStep.UPLOAD:
        return 'Upload a design or select from your products';
      case AppStep.MOCKUP_GENERATION:
        return 'Choose styles for AI-generated lifestyle photos';
      case AppStep.CAPTIONING:
        return 'Review and customize your social media captions';
      case AppStep.SUCCESS:
        return 'Your content has been published';
      default:
        return '';
    }
  };

  const getStepBadge = () => {
    const stepNumber = {
      [AppStep.UPLOAD]: 1,
      [AppStep.MOCKUP_GENERATION]: 2,
      [AppStep.CAPTIONING]: 3,
      [AppStep.REVIEW]: 4,
      [AppStep.SUCCESS]: 4,
    }[currentStep] || 1;

    return (
      <Badge tone="info">
        Step {stepNumber} of 3
      </Badge>
    );
  };

  return (
    <Page
      title={getPageTitle()}
      subtitle={getPageSubtitle()}
      titleMetadata={currentStep !== AppStep.SUCCESS ? getStepBadge() : undefined}
      backAction={
        currentStep !== AppStep.UPLOAD && currentStep !== AppStep.SUCCESS
          ? {
              content: 'Back',
              onAction: () => {
                if (currentStep === AppStep.MOCKUP_GENERATION) {
                  onReset();
                } else if (currentStep === AppStep.CAPTIONING) {
                  onStepClick(AppStep.MOCKUP_GENERATION);
                }
              },
            }
          : undefined
      }
      primaryAction={
        currentStep === AppStep.SUCCESS
          ? {
              content: 'Create Another',
              onAction: onReset,
            }
          : undefined
      }
      secondaryActions={
        currentStep === AppStep.SUCCESS
          ? [
              {
                content: 'View Calendar',
                url: '#calendar',
              },
            ]
          : undefined
      }
    >
      <Layout>
        {/* Step Indicator */}
        {currentStep !== AppStep.SUCCESS && (
          <Layout.Section>
            <StepIndicator currentStep={currentStep} onStepClick={onStepClick} />
          </Layout.Section>
        )}

        {/* Upload Step */}
        {currentStep === AppStep.UPLOAD && (
          <>
            <Layout.Section>
              <Banner tone="info">
                <p>
                  Upload your own design or{' '}
                  <Link onClick={onNavigateToProducts}>
                    browse your products
                  </Link>{' '}
                  to select an image.
                </p>
              </Banner>
            </Layout.Section>
            <Layout.Section>
              <UploadSection onUpload={onUpload} />
            </Layout.Section>
          </>
        )}

        {/* Mockup Generation Step */}
        {currentStep === AppStep.MOCKUP_GENERATION && design && (
          <Layout.Section>
            <MockupGenerator
              design={design}
              onMockupsSelected={onMockupsSelected}
              onBack={onReset}
            />
          </Layout.Section>
        )}

        {/* Caption Review Step */}
        {currentStep === AppStep.CAPTIONING && selectedMockups.length > 0 && (
          <Layout.Section>
            <CaptionReview
              mockups={selectedMockups}
              onSuccess={onSuccess}
              onBack={() => onStepClick(AppStep.MOCKUP_GENERATION)}
              onScheduled={onScheduled}
            />
          </Layout.Section>
        )}

        {/* Success Step */}
        {currentStep === AppStep.SUCCESS && (
          <Layout.Section>
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h2 className="text-3xl font-display font-bold text-slate-900 mb-4">
                Posted Successfully!
              </h2>
              <p className="text-slate-500 mb-8 leading-relaxed max-w-md mx-auto">
                Your content has been published to your selected social channels.
              </p>
            </div>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
};

export default CreatePage;

