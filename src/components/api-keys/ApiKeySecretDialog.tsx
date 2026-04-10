import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Copy, CheckCircle, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  secretKey: string
  keyName: string
}

export function ApiKeySecretDialog({ open, onOpenChange, secretKey, keyName }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(secretKey)
    setCopied(true)
    toast.success("Chave copiada!")
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Chave criada: {keyName}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-200">
            Esta chave so sera exibida <strong>uma unica vez</strong>. Copie agora e guarde em local seguro.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              readOnly
              value={secretKey}
              className="font-mono text-xs"
            />
            <Button variant="outline" size="icon" onClick={handleCopy}>
              {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Entendi, fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
