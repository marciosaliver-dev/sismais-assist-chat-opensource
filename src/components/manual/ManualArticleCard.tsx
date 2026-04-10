import { FileText, ExternalLink, Clock, ListChecks } from 'lucide-react';
import { countSteps, estimateReadingTime } from '@/lib/parseSteps';

interface ManualArticleCardProps {
  id: string;
  title: string;
  description?: string | null;
  contentHtml: string;
  tags?: string[] | null;
  productName?: string | null;
  productColor?: string | null;
}

function getDifficultyFromTags(tags?: string[] | null) {
  if (!tags) return null;
  const lower = tags.map(t => t.toLowerCase());
  if (lower.includes('avancado') || lower.includes('avançado')) {
    return { label: 'Avançado', bg: '#FEF2F2', color: '#DC2626', border: 'rgba(220,38,38,0.3)' };
  }
  if (lower.includes('intermediario') || lower.includes('intermediário')) {
    return { label: 'Intermediário', bg: '#FFFBEB', color: '#92400E', border: 'rgba(255,184,0,0.5)' };
  }
  if (lower.includes('iniciante')) {
    return { label: 'Iniciante', bg: '#F0FDF4', color: '#16A34A', border: 'rgba(22,163,74,0.3)' };
  }
  return null;
}

export function ManualArticleCard({
  id,
  title,
  description,
  contentHtml,
  tags,
  productName,
  productColor,
}: ManualArticleCardProps) {
  const steps = countSteps(contentHtml);
  const readingTime = estimateReadingTime(contentHtml);
  const difficulty = getDifficultyFromTags(tags);
  const accentColor = productColor ?? '#45E5E5';

  return (
    <a
      href={`/manual/${id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border bg-white p-4 transition-all duration-200 hover:shadow-[0_4px_12px_rgba(16,41,63,0.1)] hover:-translate-y-0.5"
      style={{
        borderColor: '#E5E5E5',
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
      }}
    >
      {/* Header: icon + title */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-lg mt-0.5"
          style={{ width: 36, height: 36, backgroundColor: '#E8F9F9' }}
        >
          <FileText size={18} style={{ color: '#10293F' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold leading-snug text-[#10293F] line-clamp-2 group-hover:text-[#1a3d5c] transition-colors">
            {title}
          </p>
        </div>
        <ExternalLink
          size={14}
          className="flex-shrink-0 mt-1 text-[#CCC] opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs leading-relaxed text-[#666666] line-clamp-2 mb-3 ml-[48px]">
          {description}
        </p>
      )}

      {/* Footer: badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-auto ml-[48px]">
        {/* Reading time */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F5F5] text-[#666] border border-[#E5E5E5]">
          <Clock size={10} />
          {readingTime} min
        </span>

        {/* Steps */}
        {steps > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5F5F5] text-[#444] border border-[#E5E5E5]">
            <ListChecks size={10} />
            {steps} {steps === 1 ? 'passo' : 'passos'}
          </span>
        )}

        {/* Product */}
        {productName && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{
              backgroundColor: accentColor + '20',
              color: '#10293F',
              borderColor: accentColor + '60',
            }}
          >
            {productName}
          </span>
        )}

        {/* Difficulty */}
        {difficulty && (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
            style={{
              backgroundColor: difficulty.bg,
              color: difficulty.color,
              borderColor: difficulty.border,
            }}
          >
            {difficulty.label}
          </span>
        )}
      </div>
    </a>
  );
}
