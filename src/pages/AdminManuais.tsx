import { ManuaisTab } from '@/components/knowledge/ManuaisTab'

export default function AdminManuais() {
  return (
    <div className="page-container">
      <div className="page-content">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manuais</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Também acessível em <strong>Conhecimento → Manuais do Cliente</strong>
            </p>
          </div>
        </div>
        <ManuaisTab />
      </div>
    </div>
  )
}
