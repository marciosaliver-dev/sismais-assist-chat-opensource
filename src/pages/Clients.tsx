import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitMerge, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ClientUnifiedSearch } from '@/components/clients/ClientUnifiedSearch'
import { ClientRegistrationWizard } from '@/components/clients/ClientRegistrationWizard'

export default function Clients() {
  const navigate = useNavigate()
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Central unificada de clientes — Local, Sismais GL e Admin</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/gl-sync')}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Sync GL
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/clients/duplicates')}>
              <GitMerge className="h-4 w-4 mr-1.5" />
              Duplicados
            </Button>
            <Button size="sm" className="gap-1 bg-[#45E5E5] text-[#10293F] hover:bg-[#2ecece]" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </div>
        <ClientUnifiedSearch />
      </div>

      <ClientRegistrationWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(clientId) => navigate(`/clients/${clientId}`)}
      />
    </div>
  )
}
