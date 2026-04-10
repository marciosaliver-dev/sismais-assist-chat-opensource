import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Phone, Mail, FileText, RefreshCw, Loader2, Building2, Search, Link2 } from 'lucide-react'
import { useCustomerProfile } from '@/hooks/useCustomerProfile'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface CustomerProfileCardProps {
  phone: string
  conversationId?: string
}

interface SearchResult {
  id: string
  nome: string | null
  documento: string | null
  phone: string
  fantasia: string | null
}

export function CustomerProfileCard({ phone, conversationId }: CustomerProfileCardProps) {
  const { profile, isLoading, refreshProfile, isRefreshing } = useCustomerProfile(phone)
  const [nameSearch, setNameSearch] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)

  const handleSearchByName = async () => {
    if (!nameSearch || nameSearch.length < 2) return
    setSearching(true)
    try {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('id, nome, documento, phone, fantasia')
        .ilike('nome', `%${nameSearch}%`)
        .limit(10)

      if (error) throw error
      setSearchResults((data || []) as SearchResult[])
    } catch (err) {
      toast.error('Erro ao buscar clientes')
      console.error(err)
    } finally {
      setSearching(false)
    }
  }

  const handleLinkCustomer = async (customer: SearchResult) => {
    if (!conversationId) {
      toast.error('Nenhuma conversa selecionada')
      return
    }
    setLinking(true)
    try {
      const { error } = await supabase
        .from('ai_conversations')
        .update({
          customer_name: customer.nome,
          customer_phone: customer.phone,
        })
        .eq('id', conversationId)

      if (error) throw error
      toast.success(`Cliente "${customer.nome}" vinculado com sucesso!`)
      setNameSearch('')
      setSearchResults([])
    } catch (err) {
      toast.error('Erro ao vincular cliente')
      console.error(err)
    } finally {
      setLinking(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-3 flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  const cadastro = (profile?.dados_cadastrais || {}) as Record<string, unknown>

  return (
    <Card>
      <CardHeader className="p-3 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Dados do Cliente
          </CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={refreshProfile}
            disabled={isRefreshing}
            title="Atualizar dados do SISMAIS"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3">
        {!profile ? (
          <div className="space-y-3">
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground mb-2">Cliente não encontrado no SISMAIS</p>
              <Button size="sm" variant="outline" onClick={refreshProfile} disabled={isRefreshing}>
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  'Buscar no SISMAIS'
                )}
              </Button>
            </div>

            <Separator />

            {/* Manual search by name */}
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Buscar por nome
              </p>
              <div className="flex gap-1.5">
                <Input
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchByName()}
                  placeholder="Nome do cliente..."
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 shrink-0"
                  onClick={handleSearchByName}
                  disabled={searching || nameSearch.length < 2}
                >
                  {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleLinkCustomer(result)}
                      disabled={linking}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors text-left border border-border"
                    >
                      <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{result.nome || 'Sem nome'}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {result.documento && <span>{result.documento}</span>}
                          <span className="font-mono">{result.phone}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
            {searchResults.length === 0 && nameSearch.length >= 2 && !searching && (
              <p className="text-xs text-muted-foreground text-center">Nenhum resultado encontrado</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {profile.nome && (
              <div className="flex items-start gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="text-sm font-medium">{profile.nome}</p>
                  {profile.fantasia && profile.fantasia !== profile.nome && (
                    <p className="text-xs text-muted-foreground">{profile.fantasia}</p>
                  )}
                </div>
              </div>
            )}

            {profile.documento && (
              <div className="flex items-start gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Documento</p>
                  <p className="text-sm font-medium font-mono">{profile.documento}</p>
                </div>
              </div>
            )}

            {profile.email && (
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm">{profile.email}</p>
                </div>
              </div>
            )}

            {profile.phone && (
              <div className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p className="text-sm font-mono">{profile.phone}</p>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-wrap gap-1.5">
              {cadastro.is_cliente && (
                <Badge variant="default" className="text-xs">Cliente</Badge>
              )}
              {cadastro.is_afiliado && (
                <Badge variant="secondary" className="text-xs">Afiliado</Badge>
              )}
              {!cadastro.is_cliente && !cadastro.is_afiliado && (
                <Badge variant="outline" className="text-xs">Lead</Badge>
              )}
            </div>

            {profile.last_synced_at && (
              <p className="text-xs text-muted-foreground">
                Sincronizado: {new Date(profile.last_synced_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
