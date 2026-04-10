import type { Step } from '@/lib/parseSteps';

interface ManualTableOfContentsProps {
  steps: Step[];
  activeStep: number;
  onStepClick: (index: number) => void;
}

export function ManualTableOfContents({
  steps,
  activeStep,
  onStepClick,
}: ManualTableOfContentsProps) {
  return (
    <aside
      className="hidden lg:block sticky top-20 flex-shrink-0"
      style={{ width: 220 }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: '#666666', letterSpacing: '0.05em' }}
      >
        Neste artigo
      </p>

      <nav>
        <ol className="flex flex-col gap-1">
          {steps.map((step, index) => {
            const isActive = index === activeStep;

            return (
              <li key={index}>
                <button
                  onClick={() => onStepClick(index)}
                  className="w-full flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all duration-150"
                  style={
                    isActive
                      ? { backgroundColor: '#E8F9F9' }
                      : { backgroundColor: 'transparent' }
                  }
                  onMouseEnter={e => {
                    if (!isActive)
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F5F5F5';
                  }}
                  onMouseLeave={e => {
                    if (!isActive)
                      (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Numbered circle */}
                  <span
                    className="flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      width: 20,
                      height: 20,
                      backgroundColor: isActive ? '#45E5E5' : '#E5E5E5',
                      color: isActive ? '#10293F' : '#666666',
                    }}
                  >
                    {index + 1}
                  </span>

                  {/* Step title */}
                  <span
                    className="text-xs leading-snug truncate"
                    style={{
                      color: isActive ? '#10293F' : '#444444',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    {step.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
