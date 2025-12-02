import React from 'react';
import { AppStep } from '../types';
import { UploadCloud, Image, PenTool, CheckCircle, Check } from 'lucide-react';

interface Props {
  currentStep: AppStep;
  onStepClick?: (step: AppStep) => void;
}

const steps = [
  { id: AppStep.UPLOAD, label: 'Upload', icon: UploadCloud },
  { id: AppStep.MOCKUP_GENERATION, label: 'Mockup', icon: Image },
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
    <div className="w-full max-w-2xl mx-auto mb-10">
      <div className="flex justify-between items-center relative">
        {/* Background Connector Line */}
        <div className="absolute left-[5%] right-[5%] top-5 h-0.5 bg-slate-200" />
        
        {/* Progress Connector Line */}
        <div 
          className="absolute left-[5%] top-5 h-0.5 bg-gradient-to-r from-indigo-600 to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${progressPercent * 0.9}%` }}
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
            >
              {/* Step Circle */}
              <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
                ${status === 'completed' 
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/30' 
                  : status === 'current'
                    ? 'bg-white border-2 border-indigo-500 text-indigo-600 shadow-lg animate-pulse-ring'
                    : 'bg-slate-100 border-2 border-slate-200 text-slate-400'
                }
                ${isClickable ? 'group-hover:scale-110 group-hover:shadow-lg' : ''}
              `}>
                {status === 'completed' ? (
                  <Check size={18} strokeWidth={3} />
                ) : (
                  <Icon size={18} />
                )}
              </div>
              
              {/* Step Label */}
              <span className={`
                text-xs mt-2.5 font-semibold transition-colors
                ${status === 'completed' 
                  ? 'text-indigo-600' 
                  : status === 'current'
                    ? 'text-slate-800'
                    : 'text-slate-400'
                }
                ${isClickable ? 'group-hover:text-indigo-700' : ''}
              `}>
                {step.label}
              </span>
              
              {/* Clickable hint on hover */}
              {isClickable && (
                <span className="absolute -bottom-5 text-[10px] text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Go back
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
