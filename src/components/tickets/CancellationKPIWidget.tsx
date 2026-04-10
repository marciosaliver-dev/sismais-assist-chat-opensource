import { useCancellationKPIs } from '@/hooks/useCancellationKPIs';
import { TrendingUp, Clock, DollarSign, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

interface CancellationKPIWidgetProps {
  boardId: string;
}

export function CancellationKPIWidget({ boardId }: CancellationKPIWidgetProps) {
  const { data, isLoading } = useCancellationKPIs(boardId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-3 py-2 border-b border-gms-g200 bg-white">
        <Spinner />
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      label: 'Taxa de Reversão',
      value: `${data.reversalRate}%`,
      icon: TrendingUp,
      colorClass: data.reversalRate >= 40 ? 'text-gms-success' : 'text-gms-error',
      bgClass: data.reversalRate >= 40 ? 'bg-green-50' : 'bg-red-50',
    },
    {
      label: 'Tempo Médio 1° Contato',
      value: `${data.avgFirstContactMinutes} min`,
      icon: Clock,
      colorClass: data.avgFirstContactMinutes < 120 ? 'text-gms-success' : 'text-gms-error',
      bgClass: data.avgFirstContactMinutes < 120 ? 'bg-green-50' : 'bg-red-50',
    },
    {
      label: 'MRR Salvo',
      value: `R$ ${data.mrrSaved.toLocaleString('pt-BR')}`,
      icon: DollarSign,
      colorClass: 'text-gms-success',
      bgClass: 'bg-green-50',
    },
    {
      label: 'MRR Perdido',
      value: `R$ ${data.mrrLost.toLocaleString('pt-BR')}`,
      icon: DollarSign,
      colorClass: 'text-gms-error',
      bgClass: 'bg-red-50',
    },
    {
      label: 'Sem Resposta',
      value: `${data.noResponseRate}%`,
      icon: PhoneOff,
      colorClass: data.noResponseRate <= 10 ? 'text-gms-success' : 'text-gms-error',
      bgClass: data.noResponseRate <= 10 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-gms-g200 bg-white overflow-x-auto">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gms-g100 min-w-0 shrink-0"
        >
          <div className={cn('w-7 h-7 rounded-md flex items-center justify-center', kpi.bgClass)}>
            <kpi.icon className={cn('w-4 h-4', kpi.colorClass)} />
          </div>
          <div>
            <p className="text-[10px] font-medium text-gms-g500 uppercase tracking-wider">
              {kpi.label}
            </p>
            <p className={cn('text-sm font-bold text-gms-navy')}>{kpi.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
