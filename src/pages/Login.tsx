import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import logoIcon from '@/assets/logo-mais-simples-icon.png'
import logoHorizontal from '@/assets/logo-sismais-horizontal.png'

export default function Login() {
  const { signIn } = useSupabaseAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signIn(email, password)
      toast.success('Login realizado com sucesso!')
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #10293F 0%, #1a3d5c 50%, #10293F 100%)',
      }}
    >
      <Card className="w-full max-w-md border-[#E5E5E5] shadow-[0_10px_40px_rgba(16,41,63,0.3)]">
        <CardHeader className="text-center space-y-4">
          <img src={logoIcon} alt="Mais Simples" className="mx-auto w-16 h-16 rounded-xl object-contain" />
          <div>
            <img src={logoHorizontal} alt="Mais Simples" className="mx-auto h-8 object-contain" />
            <CardDescription className="mt-2">
              Faca login para acessar o Atendimento Inteligente
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={loading}
              style={{
                background: '#45E5E5',
                color: '#10293F',
                borderColor: '#45E5E5',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#2ecece' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#45E5E5' }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Nao tem uma conta?{' '}
            <Link to="/register" className="font-medium hover:underline" style={{ color: '#45E5E5' }}>
              Solicitar acesso
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
