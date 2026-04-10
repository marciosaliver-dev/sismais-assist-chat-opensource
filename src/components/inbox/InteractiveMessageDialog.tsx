import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Plus, Trash2, ListOrdered, LayoutGrid } from 'lucide-react'

interface InteractiveButton {
  id: string
  text: string
}

interface ListRow {
  id: string
  title: string
  description: string
}

interface ListSection {
  title: string
  rows: ListRow[]
}

export interface InteractivePayload {
  type: 'buttons' | 'list'
  body: string
  footer?: string
  buttons?: InteractiveButton[]
  listTitle?: string
  listButtonText?: string
  listSections?: ListSection[]
}

interface InteractiveMessageDialogProps {
  onSend: (payload: InteractivePayload) => void
  disabled?: boolean
}

export function InteractiveMessageDialog({ onSend, disabled }: InteractiveMessageDialogProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'buttons' | 'list'>('buttons')

  // Buttons state
  const [body, setBody] = useState('')
  const [footer, setFooter] = useState('')
  const [buttons, setButtons] = useState<InteractiveButton[]>([
    { id: 'btn_1', text: '' },
  ])

  // List state
  const [listTitle, setListTitle] = useState('')
  const [listButtonText, setListButtonText] = useState('Ver opções')
  const [sections, setSections] = useState<ListSection[]>([
    { title: 'Opções', rows: [{ id: 'row_1', title: '', description: '' }] },
  ])

  const addButton = () => {
    if (buttons.length >= 3) return
    setButtons([...buttons, { id: `btn_${buttons.length + 1}`, text: '' }])
  }

  const removeButton = (idx: number) => {
    if (buttons.length <= 1) return
    setButtons(buttons.filter((_, i) => i !== idx))
  }

  const updateButton = (idx: number, text: string) => {
    setButtons(buttons.map((b, i) => (i === idx ? { ...b, text } : b)))
  }

  const addRow = (sectionIdx: number) => {
    if (sections[sectionIdx].rows.length >= 10) return
    const updated = [...sections]
    updated[sectionIdx].rows.push({
      id: `row_${Date.now()}`,
      title: '',
      description: '',
    })
    setSections(updated)
  }

  const removeRow = (sectionIdx: number, rowIdx: number) => {
    if (sections[sectionIdx].rows.length <= 1) return
    const updated = [...sections]
    updated[sectionIdx].rows = updated[sectionIdx].rows.filter((_, i) => i !== rowIdx)
    setSections(updated)
  }

  const updateRow = (sectionIdx: number, rowIdx: number, field: 'title' | 'description', value: string) => {
    const updated = [...sections]
    updated[sectionIdx].rows[rowIdx][field] = value
    setSections(updated)
  }

  const addSection = () => {
    if (sections.length >= 5) return
    setSections([...sections, { title: '', rows: [{ id: `row_${Date.now()}`, title: '', description: '' }] }])
  }

  const removeSection = (idx: number) => {
    if (sections.length <= 1) return
    setSections(sections.filter((_, i) => i !== idx))
  }

  const isValid = () => {
    if (!body.trim()) return false
    if (tab === 'buttons') {
      return buttons.every((b) => b.text.trim()) && buttons.length >= 1
    }
    return sections.every(
      (s) => s.title.trim() && s.rows.every((r) => r.title.trim())
    ) && listButtonText.trim()
  }

  const handleSend = () => {
    if (!isValid()) return
    const payload: InteractivePayload =
      tab === 'buttons'
        ? { type: 'buttons', body, footer: footer || undefined, buttons }
        : {
            type: 'list',
            body,
            footer: footer || undefined,
            listTitle: listTitle || undefined,
            listButtonText,
            listSections: sections,
          }
    onSend(payload)
    resetForm()
    setOpen(false)
  }

  const resetForm = () => {
    setBody('')
    setFooter('')
    setButtons([{ id: 'btn_1', text: '' }])
    setListTitle('')
    setListButtonText('Ver opções')
    setSections([{ title: 'Opções', rows: [{ id: 'row_1', title: '', description: '' }] }])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          disabled={disabled}
          title="Mensagem interativa"
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <LayoutGrid className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mensagem Interativa</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'buttons' | 'list')}>
          <TabsList className="w-full">
            <TabsTrigger value="buttons" className="flex-1 gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" /> Botões
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 gap-1.5">
              <ListOrdered className="w-3.5 h-3.5" /> Lista
            </TabsTrigger>
          </TabsList>

          {/* Shared fields */}
          <div className="space-y-3 mt-4">
            <div>
              <Label>Mensagem *</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Texto principal da mensagem"
                rows={3}
              />
            </div>
            <div>
              <Label>Rodapé (opcional)</Label>
              <Input
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="Ex: SisCRM"
              />
            </div>
          </div>

          {/* Buttons tab */}
          <TabsContent value="buttons" className="space-y-3 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Botões (máx. 3)</Label>
              <Button variant="ghost" size="sm" onClick={addButton} disabled={buttons.length >= 3}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            {buttons.map((btn, idx) => (
              <div key={btn.id} className="flex items-center gap-2">
                <Input
                  value={btn.text}
                  onChange={(e) => updateButton(idx, e.target.value)}
                  placeholder={`Botão ${idx + 1}`}
                  maxLength={20}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeButton(idx)}
                  disabled={buttons.length <= 1}
                  className="shrink-0 text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            {/* Preview */}
            <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Pré-visualização</p>
              <div className="bg-card rounded-lg p-3 max-w-[250px] shadow-sm border border-border">
                <p className="text-sm whitespace-pre-wrap">{body || 'Texto da mensagem'}</p>
                {footer && <p className="text-xs text-muted-foreground mt-1">{footer}</p>}
                <div className="mt-2 space-y-1">
                  {buttons.map((btn, idx) => (
                    <div
                      key={idx}
                      className="text-center text-xs font-medium text-primary border-t border-border pt-1.5"
                    >
                      {btn.text || `Botão ${idx + 1}`}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* List tab */}
          <TabsContent value="list" className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título da lista (opcional)</Label>
                <Input value={listTitle} onChange={(e) => setListTitle(e.target.value)} placeholder="Menu" />
              </div>
              <div>
                <Label>Texto do botão *</Label>
                <Input value={listButtonText} onChange={(e) => setListButtonText(e.target.value)} placeholder="Ver opções" />
              </div>
            </div>

            {sections.map((section, sIdx) => (
              <div key={sIdx} className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={section.title}
                    onChange={(e) => {
                      const updated = [...sections]
                      updated[sIdx].title = e.target.value
                      setSections(updated)
                    }}
                    placeholder="Nome da seção"
                    className="font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSection(sIdx)}
                    disabled={sections.length <= 1}
                    className="shrink-0 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {section.rows.map((row, rIdx) => (
                  <div key={row.id} className="flex items-start gap-2 pl-3">
                    <div className="flex-1 space-y-1">
                      <Input
                        value={row.title}
                        onChange={(e) => updateRow(sIdx, rIdx, 'title', e.target.value)}
                        placeholder="Título do item"
                        className="h-8 text-sm"
                      />
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(sIdx, rIdx, 'description', e.target.value)}
                        placeholder="Descrição (opcional)"
                        className="h-7 text-xs"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(sIdx, rIdx)}
                      disabled={section.rows.length <= 1}
                      className="shrink-0 text-destructive mt-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}

                <Button variant="ghost" size="sm" onClick={() => addRow(sIdx)} disabled={section.rows.length >= 10} className="ml-3">
                  <Plus className="w-3 h-3 mr-1" /> Item
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addSection} disabled={sections.length >= 5}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Seção
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSend} disabled={!isValid()}>
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
