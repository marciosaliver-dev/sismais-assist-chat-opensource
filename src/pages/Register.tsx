import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import logoIcon from '@/assets/logo-mais-simples-icon.png'
import logoHorizontal from '@/assets/logo-sismais-horizontal.png'

export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) {
      toast.error('Preencha todos os campos')
      return
    }
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('register-user', {
        body: { name: name.trim(), email: email.trim(), password },
      })

      if (error) {
        let parsedMessage = error.message || 'Erro ao realizar cadastro'
        const context = (error as any)?.context

        if (context instanceof Response) {
          const errorBody = await context.json().catch(() => null)
          if (errorBody?.error) parsedMessage = errorBody.error
        }

        throw new Error(parsedMessage)
      }

      if (data?.error) throw new Error(data.error)

      toast.success('Cadastro realizado! Aguardando aprovação do administrador.')
      navigate('/pending')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao realizar cadastro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center space-y-4">
          <img src={logoIcon} alt="Mais Simples" className="mx-auto w-16 h-16 rounded-xl object-contain" />
          <div>
            <img src={logoHorizontal} alt="Mais Simples" className="mx-auto h-8 object-contain" />
            <CardTitle className="mt-3 text-xl">Solicitar Acesso</CardTitle>
            <CardDescription className="mt-1">
              Preencha seus dados para solicitar acesso à plataforma
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nome completo</label>
              <Input
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Senha</label>
              <Input
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {loading ? 'Enviando...' : 'Solicitar Acesso'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Fazer login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
