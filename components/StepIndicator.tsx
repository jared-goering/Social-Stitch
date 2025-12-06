import React from 'react';
import { AppStep } from '../types';
import { Check, ChevronRight } from 'lucide-react';

interface Props {
  currentStep: AppStep;
  onStepClick?: (step: AppStep) => void;
}

const steps = [
  { id: AppStep.UPLOAD, label: 'Upload' },
  { id: AppStep.MOCKUP_GENERATION, label: 'AI Mockup' },
  { id: AppStep.CAPTIONING, label: 'Captions' },
  { id: AppStep.REVIEW, label: 'Review' },
];

export const StepIndicator: React.FC<Props> = ({ currentStep, onStepClick }) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  
  const getStepStatus = (index: number) => {
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  const handleStepClick = (step: AppStep, index: number) => {
    // Only allow clicking on completed steps to go back
    if (index < currentIndex && onStepClick) {
      onStepClick(step);
    }
  };

  // Calculate progress percentage
  const progressPercent = (currentIndex / (steps.length - 1)) * 100;

  return (
    <div className="w-full mb-4">
      {/* Breadcrumb-style steps */}
      <div className="flex items-center justify-center gap-1 mb-2">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isClickable = index < currentIndex && onStepClick;
          const isLast = index === steps.length - 1;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => handleStepClick(step.id, index)}
                disabled={!isClickable}
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all
                  ${status === 'completed'
                    ? 'text-coral-600 hover:bg-coral-50 cursor-pointer'
                    : status === 'current'
                      ? 'text-slate-warm-800 bg-slate-warm-100'
                      : 'text-slate-warm-400 cursor-default'
                  }
                  ${isClickable ? 'hover:text-coral-700' : ''}
                `}
              >
                {status === 'completed' && (
                  <Check size={12} strokeWidth={3} className="text-coral-500" />
                )}
                {status === 'current' && (
                  <span className="w-4 h-4 rounded-full bg-coral-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                )}
                <span>{step.label}</span>
              </button>
              {!isLast && (
                <ChevronRight size={12} className="text-slate-warm-300 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Thin progress bar */}
      <div className="h-1 bg-slate-warm-200 rounded-full overflow-hidden max-w-md mx-auto">
        <div
          className="h-full bg-gradient-to-r from-coral-500 to-coral-400 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
