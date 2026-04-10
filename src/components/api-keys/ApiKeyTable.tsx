import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiKey } from "@/hooks/useApiKeys"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  starter: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  pro: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  enterprise: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
}

function formatDate(date: string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

interface Props {
  keys: ApiKey[]
  onToggle: (key: ApiKey) => void
  onDelete: (id: string) => void
}

export function ApiKeyTable({ keys, onToggle, onDelete }: Props) {
  if (keys.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhuma API key criada ainda.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Organizacao</TableHead>
            <TableHead>Prefixo</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Requests</TableHead>
            <TableHead>Ultimo uso</TableHead>
            <TableHead className="text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map(k => (
            <TableRow key={k.id}>
              <TableCell className="font-medium">{k.name}</TableCell>
              <TableCell className="text-muted-foreground">{k.organization_name || "—"}</TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{k.key_prefix}</code>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn("text-xs", planColors[k.plan])}>
                  {k.plan}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={k.is_active ? "default" : "secondary"} className="text-xs">
                  {k.is_active ? "Ativa" : "Inativa"}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {(k.request_count || 0).toLocaleString("pt-BR")}
              </TableCell>
              <TableCell className="text-muted-foreground text-xs">
                {formatDate(k.last_used_at)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggle(k)}
                    title={k.is_active ? "Desativar" : "Ativar"}
                  >
                    {k.is_active
                      ? <ToggleRight className="h-4 w-4 text-green-500" />
                      : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    }
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Revogar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revogar chave "{k.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Parceiros usando esta chave perderao acesso imediatamente. Esta acao nao pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(k.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Revogar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
