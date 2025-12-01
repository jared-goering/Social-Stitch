import React from 'react';
import { AppStep } from '../types';
import { UploadCloud, Image, PenTool, CheckCircle } from 'lucide-react';

interface Props {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.UPLOAD, label: 'Upload', icon: UploadCloud },
  { id: AppStep.MOCKUP_GENERATION, label: 'Mockup', icon: Image },
  { id: AppStep.CAPTIONING, label: 'Captions', icon: PenTool },
  { id: AppStep.REVIEW, label: 'Review', icon: CheckCircle },
];

export const StepIndicator: React.FC<Props> = ({ currentStep }) => {
  const getStepStatus = (stepId: AppStep, index: number) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="w-full max-w-3xl mx-auto mb-8">
      <div className="flex justify-between items-center relative">
        {/* Connector Line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10" />

        {steps.map((step, index) => {
          const status = getStepStatus(step.id, index);
          const Icon = step.icon;
          
          let circleClass = "bg-slate-100 border-2 border-slate-300 text-slate-400";
          if (status === 'completed') circleClass = "bg-indigo-600 border-indigo-600 text-white";
          if (status === 'current') circleClass = "bg-white border-2 border-indigo-600 text-indigo-600";

          return (
            <div key={step.id} className="flex flex-col items-center bg-slate-50 px-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 ${circleClass}`}>
                <Icon size={20} />
              </div>
              <span className={`text-xs mt-2 font-medium ${status === 'upcoming' ? 'text-slate-400' : 'text-slate-700'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
