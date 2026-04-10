interface ManualProgressBarProps {
  currentStep: number;
  totalSteps: number;
  title: string;
}

export function ManualProgressBar({ currentStep, totalSteps, title }: ManualProgressBarProps) {
  const percent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  return (
    <div
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        borderColor: '#E5E5E5',
      }}
    >
      <div className="flex items-center gap-4 px-6 py-3">
        {/* Title */}
        <p
          className="flex-1 min-w-0 text-sm font-semibold truncate"
          style={{ color: '#10293F' }}
        >
          {title}
        </p>

        {/* Step counter */}
        <span
          className="flex-shrink-0 text-xs font-medium whitespace-nowrap"
          style={{ color: '#666666' }}
        >
          Passo {currentStep} de {totalSteps}
        </span>
      </div>

      {/* Progress track */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: '#E5E5E5' }}
      >
        <div
          className="h-full transition-all duration-300 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: '#45E5E5',
          }}
        />
      </div>
    </div>
  );
}
