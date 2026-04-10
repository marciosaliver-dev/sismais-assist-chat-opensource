import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Search, Loader2, Building2, Phone, UserCheck, AlertTriangle } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface HelpdeskClient {
  id: string
  name: string
  company_name: string | null
  phone: string | null
  cnpj: string | null
  email: string | null
  subscribed_product: string | null
}

interface LinkClientBeforeCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  conversationPhone?: string | null
  onClientLinked: () => void
}

export function LinkClientBeforeCloseDialog({
  open,
  onOpenChange,
  conversationId,
  conversationPhone,
  onClientLinked,
}: LinkClientBeforeCloseDialogProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState(conversationPhone || '')
  const [linking, setLinking] = useState<string | null>(null)

  const debouncedSearch = useDebounce(searchQuery, 400)

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['link-client-search', debouncedSearch],
    queryFn: async () => {
      if (debouncedSearch.length < 2) return []
      const term = `%${debouncedSearch}%`
      const { data } = await supabase
        .from('helpdesk_clients')
        .select('id, name, company_name, phone, cnpj, email, subscribed_product')
        .or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},cnpj.ilike.${term},company_name.ilike.${term}`)
        .limit(8)
      return (data || []) as HelpdeskClient[]
    },
    enabled: open && debouncedSearch.length >= 2,
  })

  const handleLink = async (client: HelpdeskClient) => {
    setLinking(client.id)
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({ helpdesk_client_id: client.id } as any)
        .eq('id', conversationId)
      if (error) throw error

      toast.success(`Cliente "${client.name}" vinculado com sucesso!`)
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conv-helpdesk', conversationId] })
      onOpenChange(false)
      onClientLinked()
    } catch {
      toast.error('Erro ao vincular cliente')
    } finally {
      setLinking(null)
    }
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Cliente obrigatório para finalizar
          </DialogTitle>
          <DialogDescription>
            Este atendimento não possui um cliente vinculado. Pesquise e associe um cliente antes de finalizar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, telefone, CNPJ ou e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Results */}
          {debouncedSearch.length >= 2 && (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {!searching && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum cliente encontrado para "{debouncedSearch}"
                </p>
              )}
              {searchResults.map((client) => (
                <button
                  key={client.id}
                  disabled={linking === client.id}
                  onClick={() => handleLink(client)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg border border-border',
                    'hover:bg-accent hover:border-primary/30 transition-colors text-left',
                    'disabled:opacity-60 disabled:cursor-not-allowed'
                  )}
                >
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                      {initials(client.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {client.company_name && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <Building2 className="w-3 h-3 shrink-0" />
                          {client.company_name}
                        </span>
                      )}
                      {client.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 shrink-0" />
                          {client.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {linking === client.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <UserCheck className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          )}

          {debouncedSearch.length < 2 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Digite ao menos 2 caracteres para pesquisar
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
