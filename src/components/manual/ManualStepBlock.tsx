import { forwardRef } from 'react';
import DOMPurify from 'dompurify';

interface ManualStepBlockProps {
  stepNumber: number;
  title: string;
  /** HTML content — sanitized with DOMPurify before render */
  content: string;
  isActive: boolean;
  isLast: boolean;
}

export const ManualStepBlock = forwardRef<HTMLDivElement, ManualStepBlockProps>(
  ({ stepNumber, title, content, isActive, isLast }, ref) => {
    // DOMPurify sanitiza todo HTML externo antes de inserir no DOM
    const safeHtml = DOMPurify.sanitize(content);

    const innerHtmlProp = { __html: safeHtml };

    return (
      <div
        ref={ref}
        className="flex gap-4 transition-opacity duration-300"
        style={{ opacity: isActive ? 1 : 0.6 }}
      >
        {/* Coluna esquerda: número + linha tracejada */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div
            className="flex items-center justify-center rounded-full text-sm font-bold flex-shrink-0 transition-all duration-300"
            style={{
              width: 40,
              height: 40,
              backgroundColor: '#45E5E5',
              color: '#10293F',
              boxShadow: isActive ? '0 4px 14px rgba(69,229,229,0.3)' : 'none',
            }}
          >
            {stepNumber}
          </div>

          {!isLast && (
            <div
              className="flex-1 mt-2"
              style={{
                width: 2,
                minHeight: 32,
                borderLeft: '2px dashed #E5E5E5',
              }}
            />
          )}
        </div>

        {/* Coluna direita: título + conteúdo */}
        <div className="step-content flex-1 pb-8">
          <h3
            className="font-semibold mb-3 leading-snug"
            style={{ fontSize: '16px', color: '#10293F' }}
          >
            {title}
          </h3>

          {/* Conteúdo sanitizado pelo DOMPurify — sem risco de XSS */}
          <div
            className="prose prose-sm max-w-none"
            style={{ color: '#333333' }}
            dangerouslySetInnerHTML={innerHtmlProp}
          />
        </div>

        <style>{`
          .step-content img {
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(16,41,63,0.1), 0 2px 4px -1px rgba(16,41,63,0.06);
            border: 1px solid #E5E5E5;
            max-width: 100%;
            height: auto;
            margin: 12px 0;
          }
        `}</style>
      </div>
    );
  }
);

ManualStepBlock.displayName = 'ManualStepBlock';
