import { useState } from "react"
import { Key, Plus, Shield, FileText, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/spinner"
import { ApiKeyTable } from "@/components/api-keys/ApiKeyTable"
import { CreateApiKeyDialog } from "@/components/api-keys/CreateApiKeyDialog"
import { ApiKeySecretDialog } from "@/components/api-keys/ApiKeySecretDialog"
import { ApiDocs } from "@/components/api-keys/ApiDocs"
import { ApiMonitor } from "@/components/api-keys/ApiMonitor"
import { useApiKeysList, useToggleApiKey, useDeleteApiKey } from "@/hooks/useApiKeys"
import type { ApiKey } from "@/hooks/useApiKeys"

export default function AdminApiKeys() {
  const [createOpen, setCreateOpen] = useState(false)
  const [secretData, setSecretData] = useState<{ key: string; name: string } | null>(null)

  const { data: keys, isLoading } = useApiKeysList()
  const toggleMutation = useToggleApiKey()
  const deleteMutation = useDeleteApiKey()

  function handleToggle(key: ApiKey) {
    toggleMutation.mutate({ id: key.id, is_active: key.is_active })
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id)
  }

  function handleKeyCreated(data: { key: string; name: string }) {
    setSecretData(data)
  }

  return (
    <div className="page-container"><div className="page-content">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Key className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">API Parceiros</h1>
            <p className="text-sm text-muted-foreground">Gerencie chaves, documentacao e monitore o uso da API</p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Chave
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="keys" className="space-y-4">
        <TabsList>
          <TabsTrigger value="keys" className="gap-1.5">
            <Key className="h-4 w-4" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Documentacao
          </TabsTrigger>
          <TabsTrigger value="monitor" className="gap-1.5">
            <Activity className="h-4 w-4" />
            Monitor
          </TabsTrigger>
        </TabsList>

        {/* Aba Keys */}
        <TabsContent value="keys" className="space-y-4">
          {/* Info banner */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-400">API Publica v1 — Somente Leitura</p>
              <p className="text-muted-foreground mt-1">
                Parceiros podem consultar conversas, tickets e clientes via <code className="text-xs bg-muted px-1 rounded">GET</code> endpoints.
                Autenticacao via header <code className="text-xs bg-muted px-1 rounded">X-API-Key</code>.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <ApiKeyTable
              keys={keys || []}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

        {/* Aba Docs */}
        <TabsContent value="docs">
          <ApiDocs />
        </TabsContent>

        {/* Aba Monitor */}
        <TabsContent value="monitor">
          <ApiMonitor />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onKeyCreated={handleKeyCreated}
      />

      {secretData && (
        <ApiKeySecretDialog
          open={!!secretData}
          onOpenChange={() => setSecretData(null)}
          secretKey={secretData.key}
          keyName={secretData.name}
        />
      )}
    </div></div>
  )
}
