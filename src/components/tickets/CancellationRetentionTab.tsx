import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Save } from "lucide-react"

interface CancellationRetentionTabProps {
  conversationId: string
  context: Record<string, any> | null
  onUpdate: () => void
}

const CANCELLATION_REASONS = [
  "Preço",
  "Fechamento do negócio",
  "Migrou para concorrente",
  "Falta de uso/não adaptou",
  "Insatisfação com suporte",
  "Bug ou problema técnico não resolvido",
  "Outro",
]

const ENTRY_CHANNELS = ["Suporte", "WhatsApp", "E-mail", "Ligação"]

const CONTACT_CHANNELS = ["WhatsApp", "Ligação", "E-mail"]

const RETENTION_OFFERS = [
  "Nenhuma",
  "Desconto temporário",
  "Pausa de assinatura",
  "Suporte dedicado",
  "Treinamento",
  "Resolução de bug",
  "Outro",
]

const FINAL_RESULTS = ["Pendente", "Revertido", "Cancelado"]

const resultBadgeClass: Record<string, string> = {
  Revertido: "bg-green-100 text-green-700 border-green-300",
  Cancelado: "bg-red-100 text-red-700 border-red-300",
  Pendente: "bg-yellow-100 text-yellow-700 border-yellow-300",
}

export default function CancellationRetentionTab({
  conversationId,
  context,
  onUpdate,
}: CancellationRetentionTabProps) {
  const [form, setForm] = useState({
    cancellation_reason: "",
    cancellation_reason_detail: "",
    entry_channel: "",
    contact_attempts: 0,
    contact_channel: "",
    retention_offer: "Nenhuma",
    retention_offer_detail: "",
    final_result: "Pendente",
    mrr_value: 0,
    tenure_months: 0,
    observations: "",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (context) {
      setForm((prev) => ({
        ...prev,
        cancellation_reason: context.cancellation_reason ?? "",
        cancellation_reason_detail: context.cancellation_reason_detail ?? "",
        entry_channel: context.entry_channel ?? "",
        contact_attempts: context.contact_attempts ?? 0,
        contact_channel: context.contact_channel ?? "",
        retention_offer: context.retention_offer ?? "Nenhuma",
        retention_offer_detail: context.retention_offer_detail ?? "",
        final_result: context.final_result ?? "Pendente",
        mrr_value: context.mrr_value ?? 0,
        tenure_months: context.tenure_months ?? 0,
        observations: context.observations ?? "",
      }))
    }
  }, [context])

  const set = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const newContext = { ...(context ?? {}), ...form }
      const { error } = await supabase
        .from("ai_conversations")
        .update({ context: newContext })
        .eq("id", conversationId)
      if (error) throw error
      toast.success("Dados de retenção atualizados")
      onUpdate()
    } catch {
      toast.error("Erro ao salvar dados de retenção")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Dados do Cancelamento */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Dados do Cancelamento
        </h3>

        <div className="flex flex-col gap-1.5">
          <Label>Motivo do Cancelamento</Label>
          <Select value={form.cancellation_reason} onValueChange={(v) => set("cancellation_reason", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {CANCELLATION_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.cancellation_reason === "Outro" && (
            <Input
              placeholder="Detalhe o motivo"
              value={form.cancellation_reason_detail}
              onChange={(e) => set("cancellation_reason_detail", e.target.value)}
              className="mt-1"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Canal de Entrada</Label>
          <Select value={form.entry_channel} onValueChange={(v) => set("entry_channel", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {ENTRY_CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Retenção */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Retenção
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tentativas de Contato</Label>
            <Input
              type="number"
              min={0}
              value={form.contact_attempts}
              onChange={(e) => set("contact_attempts", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Canal de Contato</Label>
            <Select value={form.contact_channel} onValueChange={(v) => set("contact_channel", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {CONTACT_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Oferta de Retenção</Label>
          <Select value={form.retention_offer} onValueChange={(v) => set("retention_offer", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {RETENTION_OFFERS.map((o) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.retention_offer === "Outro" && (
            <Input
              placeholder="Detalhe a oferta"
              value={form.retention_offer_detail}
              onChange={(e) => set("retention_offer_detail", e.target.value)}
              className="mt-1"
            />
          )}
        </div>
      </section>

      {/* Encerramento */}
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Encerramento
        </h3>

        <div className="flex flex-col gap-1.5">
          <Label>Resultado Final</Label>
          <div className="flex items-center gap-3">
            <Select value={form.final_result} onValueChange={(v) => set("final_result", v)}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FINAL_RESULTS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant="outline"
              className={cn("text-xs", resultBadgeClass[form.final_result])}
            >
              {form.final_result}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Valor MRR (R$)</Label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={form.mrr_value}
              onChange={(e) => set("mrr_value", Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Tempo de Casa (meses)</Label>
            <Input
              type="number"
              min={0}
              value={form.tenure_months}
              onChange={(e) => set("tenure_months", Number(e.target.value))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Observações</Label>
          <Textarea
            rows={3}
            placeholder="Observações sobre o cancelamento ou retenção..."
            value={form.observations}
            onChange={(e) => set("observations", e.target.value)}
          />
        </div>
      </section>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  )
}
