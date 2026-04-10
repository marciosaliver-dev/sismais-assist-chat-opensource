import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitMerge, X, Search, Users, AlertTriangle, ArrowLeft, Building2, Phone, Mail, FileText, DollarSign, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useDuplicateCandidates, type DuplicateCandidate } from '@/hooks/useDuplicateCandidates'
import { HealthScoreRing } from '@/components/clients/HealthScoreRing'

// ---------------------------------------------------------------------------
// Helper: format currency
// ---------------------------------------------------------------------------
function formatMRR(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// ---------------------------------------------------------------------------
// Helper: match score color
// ---------------------------------------------------------------------------
function scoreColor(score: number): string {
  if (score >= 90) return 'bg-red-100 text-red-700 border-red-300'
  if (score >= 70) return 'bg-amber-100 text-amber-700 border-amber-300'
  return 'bg-blue-100 text-blue-700 border-blue-300'
}

// ---------------------------------------------------------------------------
// Helper: format match reasons into readable chips
// ---------------------------------------------------------------------------
function reasonLabels(reasons: Record<string, unknown> | null): string[] {
  if (!reasons) return []
  const labels: Record<string, string> = {
    name: 'Nome',
    company_name: 'Empresa',
    phone: 'Telefone',
    email: 'E-mail',
    cnpj: 'CNPJ',
  }
  return Object.keys(reasons).map((k) => labels[k] || k)
}

// ---------------------------------------------------------------------------
// ClientInfo — reusable block showing a client's fields
// ---------------------------------------------------------------------------
interface ClientInfoProps {
  client: NonNullable<DuplicateCandidate['client_a']>
  compact?: boolean
}

function ClientInfo({ client, compact }: ClientInfoProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', compact ? 'text-xs' : 'text-sm')}>
      <p className="font-semibold text-foreground truncate">{client.name}</p>
      {client.company_name && (
        <span className="flex items-center gap-1.5 text-muted-foreground truncate">
          <Building2 className="h-3.5 w-3.5 shrink-0" /> {client.company_name}
        </span>
      )}
      {client.phone && (
        <span className="flex items-center gap-1.5 text-muted-foreground truncate">
          <Phone className="h-3.5 w-3.5 shrink-0" /> {client.phone}
        </span>
      )}
      {client.email && (
        <span className="flex items-center gap-1.5 text-muted-foreground truncate">
          <Mail className="h-3.5 w-3.5 shrink-0" /> {client.email}
        </span>
      )}
      {client.cnpj && (
        <span className="flex items-center gap-1.5 text-muted-foreground truncate">
          <FileText className="h-3.5 w-3.5 shrink-0" /> {client.cnpj}
        </span>
      )}
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <DollarSign className="h-3.5 w-3.5 shrink-0" /> MRR: {formatMRR(client.mrr_total)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DuplicateCard
// ---------------------------------------------------------------------------
interface DuplicateCardProps {
  candidate: DuplicateCandidate
  onMerge: () => void
  onReject: () => void
  isRejecting: boolean
}

function DuplicateCard({ candidate, onMerge, onReject, isRejecting }: DuplicateCardProps) {
  const { client_a, client_b, match_score, match_reasons } = candidate
  if (!client_a || !client_b) return null

  const chips = reasonLabels(match_reasons)

  return (
    <Card className="border border-border hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        {/* Top row: clients side by side */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
          {/* Client A */}
          <div className="flex items-start gap-3">
            <HealthScoreRing score={client_a.health_score} size="sm" />
            <ClientInfo client={client_a} />
          </div>

          {/* Center: score + reasons */}
          <div className="flex flex-col items-center gap-2 pt-1">
            <Badge variant="outline" className={cn('text-xs font-bold border', scoreColor(match_score))}>
              {Math.round(match_score)}%
            </Badge>
            <div className="flex flex-wrap justify-center gap-1">
              {chips.map((c) => (
                <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          {/* Client B */}
          <div className="flex items-start gap-3 justify-end text-right">
            <ClientInfo client={client_b} />
            <HealthScoreRing score={client_b.health_score} size="sm" />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onReject}
            disabled={isRejecting}
          >
            <X className="h-4 w-4 mr-1" /> Rejeitar
          </Button>
          <Button size="sm" onClick={onMerge} className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]">
            <GitMerge className="h-4 w-4 mr-1" /> Mesclar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// MergeDialog
// ---------------------------------------------------------------------------
interface MergeDialogProps {
  candidate: DuplicateCandidate | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (keepId: string, mergeId: string) => void
  isPending: boolean
}

type FieldKey = 'name' | 'company_name' | 'phone' | 'email' | 'cnpj'

const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Nome',
  company_name: 'Empresa',
  phone: 'Telefone',
  email: 'E-mail',
  cnpj: 'CNPJ',
}

function MergeDialog({ candidate, open, onOpenChange, onConfirm, isPending }: MergeDialogProps) {
  const [keepSide, setKeepSide] = useState<'a' | 'b'>('a')

  if (!candidate?.client_a || !candidate?.client_b) return null

  const a = candidate.client_a
  const b = candidate.client_b
  const keepClient = keepSide === 'a' ? a : b
  const mergeClient = keepSide === 'a' ? b : a

  const fields: FieldKey[] = ['name', 'company_name', 'phone', 'email', 'cnpj']

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-[#45E5E5]" />
            Mesclar Clientes
          </DialogTitle>
          <DialogDescription>
            Selecione qual cliente manter. Os dados do outro serao transferidos.
          </DialogDescription>
        </DialogHeader>

        {/* Keep A / Keep B buttons */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Button
            variant={keepSide === 'a' ? 'default' : 'outline'}
            className={cn(
              keepSide === 'a' && 'bg-[#10293F] text-white hover:bg-[#1a3d5c]',
            )}
            onClick={() => setKeepSide('a')}
          >
            Manter A
          </Button>
          <Button
            variant={keepSide === 'b' ? 'default' : 'outline'}
            className={cn(
              keepSide === 'b' && 'bg-[#10293F] text-white hover:bg-[#1a3d5c]',
            )}
            onClick={() => setKeepSide('b')}
          >
            Manter B
          </Button>
        </div>

        {/* Field comparison table */}
        <div className="border border-border rounded-lg overflow-hidden mt-4">
          <div className="grid grid-cols-[120px_1fr_1fr] text-xs font-semibold bg-muted/50 border-b border-border">
            <div className="p-2.5">Campo</div>
            <div className={cn('p-2.5', keepSide === 'a' && 'bg-[#45E5E5]/10')}>Cliente A {keepSide === 'a' && '(manter)'}</div>
            <div className={cn('p-2.5', keepSide === 'b' && 'bg-[#45E5E5]/10')}>Cliente B {keepSide === 'b' && '(manter)'}</div>
          </div>
          {fields.map((f) => (
            <div key={f} className="grid grid-cols-[120px_1fr_1fr] text-sm border-b border-border last:border-b-0">
              <div className="p-2.5 font-medium text-muted-foreground">{FIELD_LABELS[f]}</div>
              <div className={cn('p-2.5 truncate', keepSide === 'a' && 'bg-[#45E5E5]/5 font-medium')}>
                {a[f] || '—'}
              </div>
              <div className={cn('p-2.5 truncate', keepSide === 'b' && 'bg-[#45E5E5]/5 font-medium')}>
                {b[f] || '—'}
              </div>
            </div>
          ))}
        </div>

        {/* Merge summary */}
        <div className="bg-muted/40 rounded-lg p-4 mt-2 text-sm space-y-1.5">
          <p className="font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-[#FFB800]" /> Resumo da mesclagem
          </p>
          <p className="text-muted-foreground">
            O cliente <strong className="text-foreground">{mergeClient.name}</strong> sera removido e seus dados transferidos para{' '}
            <strong className="text-foreground">{keepClient.name}</strong>:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-1">
            <li>Contatos</li>
            <li>Contratos</li>
            <li>Conversas</li>
            <li>Eventos da timeline</li>
          </ul>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(keepClient.id, mergeClient.id)}
            disabled={isPending}
            className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
          >
            {isPending ? 'Mesclando...' : 'Confirmar Mesclagem'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="border border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
              <div className="space-y-2 flex flex-col items-end">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">Nenhuma duplicata encontrada</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        Clique em "Detectar Duplicatas" para buscar clientes com dados semelhantes.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ClientDuplicates() {
  const navigate = useNavigate()
  const { candidates, isLoading, detect, merge, reject } = useDuplicateCandidates()
  const [mergeTarget, setMergeTarget] = useState<DuplicateCandidate | null>(null)

  return (
    <div className="page-container">
      <div className="page-content space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <button onClick={() => navigate('/clients')} className="hover:text-foreground transition-colors">
            Clientes
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Duplicados</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/clients')} aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">Clientes Duplicados</h1>
                {!isLoading && (
                  <Badge variant="secondary" className="text-xs">
                    {candidates.length}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Identifique e mescle registros duplicados
              </p>
            </div>
          </div>
          <Button
            onClick={() => detect.mutate()}
            disabled={detect.isPending}
            className="bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]"
          >
            <Search className="h-4 w-4 mr-2" />
            {detect.isPending ? 'Detectando...' : 'Detectar Duplicatas'}
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSkeleton />
        ) : candidates.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {candidates.map((c) => (
              <DuplicateCard
                key={c.id}
                candidate={c}
                onMerge={() => setMergeTarget(c)}
                onReject={() => reject.mutate(c.id)}
                isRejecting={reject.isPending}
              />
            ))}
          </div>
        )}

        {/* Merge Dialog */}
        <MergeDialog
          candidate={mergeTarget}
          open={!!mergeTarget}
          onOpenChange={(v) => { if (!v) setMergeTarget(null) }}
          onConfirm={(keepId, mergeId) => {
            merge.mutate({ keepId, mergeId }, {
              onSuccess: () => setMergeTarget(null),
            })
          }}
          isPending={merge.isPending}
        />
      </div>
    </div>
  )
}
