import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Tv, ExternalLink, Save } from 'lucide-react'

const FEATURE_KEY = 'tv_dashboard_pin'

export default function TVDashboardSettingsTab() {
  const qc = useQueryClient()
  const [pin, setPin] = useState('')
  const [loaded, setLoaded] = useState(false)

  const { isLoading } = useQuery({
    queryKey: ['platform_ai_config', FEATURE_KEY],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_ai_config')
        .select('extra_config')
        .eq('feature', FEATURE_KEY)
        .maybeSingle()
      const currentPin = (data?.extra_config as Record<string, string> | null)?.pin || '1234'
      if (!loaded) {
        setPin(currentPin)
        setLoaded(true)
      }
      return currentPin
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (newPin: string) => {
      const { error } = await supabase
        .from('platform_ai_config')
        .upsert(
          { feature: FEATURE_KEY, enabled: true, extra_config: { pin: newPin } },
          { onConflict: 'feature' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform_ai_config', FEATURE_KEY] })
      toast.success('PIN salvo com sucesso')
    },
    onError: () => toast.error('Erro ao salvar PIN'),
  })

  const handleSave = () => {
    if (pin.length < 4 || pin.length > 6) {
      toast.error('PIN deve ter 4 a 6 dígitos')
      return
    }
    saveMutation.mutate(pin)
  }

  return (
    <div className="tv-settings">
      <div className="settings-card">
        <div className="sc-header">
          <div className="sc-info">
            <h3 className="sc-title">
              <Tv className="w-5 h-5" />
              TV Dashboard
            </h3>
            <p className="sc-desc">Configure o PIN de acesso à tela pública de Dashboard.</p>
          </div>
        </div>
        <div className="sc-content">
          <p className="tv-info">
            Configure o PIN de acesso à tela de Dashboard TV pública (
            <a href="/tv" target="_blank" rel="noopener noreferrer" className="tv-link">
              /tv <ExternalLink className="w-3 h-3" />
            </a>
            ). Este PIN permite acesso sem login, ideal para TVs ou monitores.
          </p>
          <div className="field">
            <Label htmlFor="tv-pin" className="field-label">PIN de Acesso (4 a 6 dígitos)</Label>
            <Input
              id="tv-pin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              disabled={isLoading}
              className="tv-input"
            />
            <span className="field-hint">Padrão: 1234. A sessão fica ativa por 8 horas.</span>
          </div>
          <Button onClick={handleSave} disabled={saveMutation.isPending || isLoading} size="sm" className="btn-primary">
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar PIN'}
          </Button>
        </div>
      </div>

      <style>{`
        .tv-settings { display: flex; flex-direction: column; gap: 16px; }
        .settings-card { background: #fff; border: 1px solid #E5E5E5; border-radius: 12px; overflow: hidden; }
        .sc-header { padding: 20px; border-bottom: 1px solid #E5E5E5; }
        .sc-info { flex: 1; }
        .sc-title { font-size: 16px; font-weight: 600; color: #10293F; margin: 0; display: flex; align-items: center; gap: 8px; }
        .sc-title .w-5.h-5 { color: #45E5E5; }
        .sc-desc { font-size: 13px; color: #666; margin: 4px 0 0; }
        .sc-content { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .tv-info { font-size: 13px; color: #666; line-height: 1.5; }
        .tv-link { color: #10293F; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 13px; font-weight: 500; color: #333; }
        .field-hint { font-size: 12px; color: #888; }
        .tv-input { max-width: 200px; }
      `}</style>
    </div>
  )
}
