import React from 'react';
import { AppStep } from '../types';
import { UploadCloud, Image, PenTool, CheckCircle, Check, Sparkles } from 'lucide-react';

interface Props {
  currentStep: AppStep;
  onStepClick?: (step: AppStep) => void;
}

const steps = [
  { id: AppStep.UPLOAD, label: 'Upload', icon: UploadCloud },
  { id: AppStep.MOCKUP_GENERATION, label: 'AI Mockup', icon: Sparkles },
  { id: AppStep.CAPTIONING, label: 'Captions', icon: PenTool },
  { id: AppStep.REVIEW, label: 'Review', icon: CheckCircle },
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

  // Calculate progress percentage for the connector line
  const progressPercent = currentIndex > 0 ? ((currentIndex) / (steps.length - 1)) * 100 : 0;

  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
      <div className="flex justify-between items-center relative">
        {/* Background Connector Line */}
        <div className="absolute left-[8%] right-[8%] top-6 h-1 bg-slate-warm-200 rounded-full" />
        
        {/* Progress Connector Line */}
        <div 
          className="absolute left-[8%] top-6 h-1 bg-gradient-to-r from-coral-500 to-coral-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progressPercent * 0.84}%` }}
        />

        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const Icon = step.icon;
          const isClickable = index < currentIndex && onStepClick;

          return (
            <div 
              key={step.id} 
              className={`
                flex flex-col items-center relative z-10
                ${isClickable ? 'cursor-pointer group' : ''}
              `}
              onClick={() => handleStepClick(step.id, index)}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Step Circle */}
              <div className={`
                w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                ${status === 'completed' 
                  ? 'bg-gradient-to-br from-coral-500 to-coral-600 text-white shadow-lg shadow-coral-500/30' 
                  : status === 'current'
                    ? 'bg-white border-2 border-coral-400 text-coral-500 shadow-xl animate-pulse-ring'
                    : 'bg-slate-warm-100 border-2 border-slate-warm-200 text-slate-warm-400'
                }
                ${isClickable ? 'group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-coral-500/20' : ''}
              `}>
                {status === 'completed' ? (
                  <Check size={20} strokeWidth={3} />
                ) : (
                  <Icon size={20} />
                )}
              </div>
              
              {/* Step Label */}
              <span className={`
                text-xs mt-3 font-semibold transition-colors tracking-wide
                ${status === 'completed' 
                  ? 'text-coral-600' 
                  : status === 'current'
                    ? 'text-slate-warm-800'
                    : 'text-slate-warm-400'
                }
                ${isClickable ? 'group-hover:text-coral-500' : ''}
              `}>
                {step.label}
              </span>
              
              {/* Step number badge for current step */}
              {status === 'current' && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-coral-500 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">{index + 1}</span>
                </div>
              )}
              
              {/* Clickable hint on hover */}
              {isClickable && (
                <span className="absolute -bottom-5 text-[10px] text-coral-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium whitespace-nowrap">
                  Click to edit
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
