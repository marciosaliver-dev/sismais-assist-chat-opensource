import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Clock, LogOut, CheckCircle } from 'lucide-react'
import logoIcon from '@/assets/logo-mais-simples-icon.png'
import logoHorizontal from '@/assets/logo-sismais-horizontal.png'

export default function PendingApproval() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center space-y-4">
          <img src={logoIcon} alt="Mais Simples" className="mx-auto w-16 h-16 rounded-xl object-contain" />
          <img src={logoHorizontal} alt="Mais Simples" className="mx-auto h-8 object-contain" />
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Cadastro em análise</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Seu cadastro foi recebido com sucesso. Um administrador irá revisar
              sua solicitação e liberar o acesso em breve.
            </p>
          </div>

          {user?.email && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              Conta cadastrada com: <span className="font-medium text-foreground">{user.email}</span>
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground text-left">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              <span>Cadastro recebido pelo sistema</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Aguardando aprovação do administrador</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={logout}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
