import { useState } from "react"
import { ThumbsDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { supabase } from "@/integrations/supabase/client"

interface ResponseFeedbackProps {
  messageId: string
  conversationId: string
  agentId?: string
  originalResponse: string
  canCorrect: boolean
}

const ERROR_TYPES = [
  { value: "incorrect_info", label: "Informação incorreta" },
  { value: "wrong_tone", label: "Tom inadequado" },
  { value: "missed_question", label: "Não respondeu a pergunta" },
  { value: "hallucination", label: "Inventou dados (alucinação)" },
  { value: "other", label: "Outro" },
] as const

export function ResponseFeedback({
  messageId,
  conversationId,
  agentId,
  originalResponse,
  canCorrect,
}: ResponseFeedbackProps) {
  const [open, setOpen] = useState(false)
  const [errorType, setErrorType] = useState<string>("")
  const [correctedResponse, setCorrectedResponse] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!canCorrect) return null

  const handleSubmit = async () => {
    if (!errorType || !correctedResponse.trim()) {
      toast.error("Preencha o tipo do erro e a resposta correta")
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.from("ai_response_corrections" as any).insert({
        message_id: messageId,
        conversation_id: conversationId,
        agent_id: agentId || null,
        corrected_by: (await supabase.auth.getUser()).data.user?.id,
        error_type: errorType,
        original_response: originalResponse,
        corrected_response: correctedResponse.trim(),
      })

      if (error) throw error

      toast.success("Correção salva! O agente vai aprender com isso.")
      setOpen(false)
      setErrorType("")
      setCorrectedResponse("")
    } catch (err) {
      toast.error("Erro ao salvar correção")
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10"
          title="Marcar resposta como incorreta"
        >
          <ThumbsDown className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Corrigir resposta do agente</h4>

          <RadioGroup value={errorType} onValueChange={setErrorType}>
            {ERROR_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <RadioGroupItem value={type.value} id={type.value} />
                <Label htmlFor={type.value} className="text-xs">
                  {type.label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Textarea
            placeholder="Resposta correta..."
            value={correctedResponse}
            onChange={(e) => setCorrectedResponse(e.target.value)}
            rows={3}
            className="text-xs"
          />

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !errorType || !correctedResponse.trim()}
            className="w-full"
          >
            {submitting ? "Salvando..." : "Salvar correção"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
