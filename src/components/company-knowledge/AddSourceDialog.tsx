import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileText, Image, Globe, Share2, Link, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const SOURCE_TYPES = [
  { id: 'pdf', label: 'PDF', icon: FileText, desc: 'Upload de documentos PDF' },
  { id: 'image', label: 'Imagem', icon: Image, desc: 'Upload com OCR/Vision' },
  { id: 'docx', label: 'DOCX/TXT', icon: FileText, desc: 'Documentos de texto' },
  { id: 'website', label: 'Website', icon: Globe, desc: 'Scraping de sites' },
  { id: 'social', label: 'Rede Social', icon: Share2, desc: 'Instagram, Facebook, LinkedIn' },
  { id: 'confluence', label: 'Confluence', icon: Link, desc: 'Atlassian Confluence' },
  { id: 'zoho', label: 'Zoho Desk', icon: Link, desc: 'Base de conhecimento Zoho' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; source_type: string; config: Record<string, any> }) => void
}

export function AddSourceDialog({ open, onOpenChange, onSubmit }: Props) {
  const [step, setStep] = useState(1)
  const [sourceType, setSourceType] = useState('')
  const [name, setName] = useState('')
  const [config, setConfig] = useState<Record<string, any>>({})

  const reset = () => { setStep(1); setSourceType(''); setName(''); setConfig({}) }
  const handleClose = (v: boolean) => { if (!v) reset(); onOpenChange(v) }

  const handleSubmit = () => {
    onSubmit({ name, source_type: sourceType, config })
    handleClose(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Fonte — Passo {step}/3</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="grid grid-cols-2 gap-3">
            {SOURCE_TYPES.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => { setSourceType(t.id); setStep(2) }}
                  className={cn(
                    'flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-muted/50 transition-colors',
                    sourceType === t.id && 'border-primary bg-primary/5'
                  )}
                >
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Nome da Fonte</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Manual do Produto v3" />
            </div>

            {(sourceType === 'pdf' || sourceType === 'image' || sourceType === 'docx') && (
              <div>
                <Label>Arquivos</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Arraste arquivos ou clique para selecionar</p>
                </div>
              </div>
            )}

            {sourceType === 'website' && (
              <>
                <div>
                  <Label>URL Base</Label>
                  <Input value={config.url || ''} onChange={e => setConfig({ ...config, url: e.target.value })} placeholder="https://seusite.com.br" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Profundidade</Label>
                    <Input type="number" min={1} max={5} value={config.depth || 2} onChange={e => setConfig({ ...config, depth: +e.target.value })} />
                  </div>
                  <div>
                    <Label>Auto-sync</Label>
                    <Select value={config.sync_frequency || 'none'} onValueChange={v => setConfig({ ...config, sync_frequency: v === 'none' ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Sem sync" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem sync</SelectItem>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {sourceType === 'social' && (
              <>
                <div>
                  <Label>Plataforma</Label>
                  <Select value={config.platform || ''} onValueChange={v => setConfig({ ...config, platform: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>URL do Perfil</Label>
                  <Input value={config.profile_url || ''} onChange={e => setConfig({ ...config, profile_url: e.target.value })} placeholder="https://instagram.com/seupage" />
                </div>
              </>
            )}

            {sourceType === 'confluence' && (
              <>
                <div>
                  <Label>URL da Instância</Label>
                  <Input value={config.base_url || ''} onChange={e => setConfig({ ...config, base_url: e.target.value })} placeholder="https://seutime.atlassian.net/wiki" />
                </div>
                <div>
                  <Label>Space Key</Label>
                  <Input value={config.space_key || ''} onChange={e => setConfig({ ...config, space_key: e.target.value })} placeholder="BCON" />
                </div>
                <div>
                  <Label>API Token</Label>
                  <Input type="password" value={config.api_token || ''} onChange={e => setConfig({ ...config, api_token: e.target.value })} placeholder="Token de acesso" />
                </div>
              </>
            )}

            {sourceType === 'zoho' && (
              <>
                <div>
                  <Label>URL do Zoho Desk</Label>
                  <Input value={config.base_url || ''} onChange={e => setConfig({ ...config, base_url: e.target.value })} placeholder="https://desk.zoho.com" />
                </div>
                <div>
                  <Label>API Key</Label>
                  <Input type="password" value={config.api_key || ''} onChange={e => setConfig({ ...config, api_key: e.target.value })} placeholder="Chave de API" />
                </div>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={!name.trim()}>Próximo</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-muted/20">
              <h4 className="text-sm font-semibold mb-2">Resumo</h4>
              <p className="text-sm"><strong>Nome:</strong> {name}</p>
              <p className="text-sm"><strong>Tipo:</strong> {SOURCE_TYPES.find(t => t.id === sourceType)?.label}</p>
              {config.url && <p className="text-sm"><strong>URL:</strong> {config.url}</p>}
              {config.platform && <p className="text-sm"><strong>Plataforma:</strong> {config.platform}</p>}
              {config.space_key && <p className="text-sm"><strong>Space:</strong> {config.space_key}</p>}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={handleSubmit}>Processar e Indexar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
