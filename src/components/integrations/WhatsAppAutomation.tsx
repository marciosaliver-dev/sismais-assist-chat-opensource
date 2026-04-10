import { Bot, Clock, MessageSquare, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsAppConfig } from "@/types/whatsapp";

interface WhatsAppAutomationProps {
  automation: WhatsAppConfig["aiAutomation"];
  onUpdate: (updates: Partial<WhatsAppConfig["aiAutomation"]>) => void;
  disabled?: boolean;
}

export function WhatsAppAutomation({ automation, onUpdate, disabled }: WhatsAppAutomationProps) {
  return (
    <Card className={disabled ? "opacity-60" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-copilot" />
          Automação com IA
        </CardTitle>
        <CardDescription>
          Configure respostas automáticas e classificação inteligente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-copilot/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-copilot" />
            </div>
            <div>
              <p className="font-medium">Ativar Automação IA</p>
              <p className="text-sm text-muted-foreground">
                Permite respostas e classificações automáticas
              </p>
            </div>
          </div>
          <Switch
            checked={automation.enabled}
            onCheckedChange={(enabled) => onUpdate({ enabled })}
            disabled={disabled}
          />
        </div>

        {/* Greeting Message */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <Label>Mensagem de Boas-vindas</Label>
          </div>
          <Textarea
            value={automation.greetingMessage}
            onChange={(e) => onUpdate({ greetingMessage: e.target.value })}
            placeholder="Digite a mensagem inicial..."
            className="min-h-[80px]"
            disabled={disabled || !automation.enabled}
          />
          <p className="text-xs text-muted-foreground">
            Esta mensagem será enviada automaticamente para novos contatos
          </p>
        </div>

        {/* Working Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Label>Horário de Atendimento</Label>
            </div>
            <Switch
              checked={automation.workingHours.enabled}
              onCheckedChange={(enabled) => 
                onUpdate({ workingHours: { ...automation.workingHours, enabled } })
              }
              disabled={disabled || !automation.enabled}
            />
          </div>
          {automation.workingHours.enabled && automation.enabled && (
            <div className="flex items-center gap-4 pl-6">
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={automation.workingHours.start}
                  onChange={(e) => 
                    onUpdate({ 
                      workingHours: { ...automation.workingHours, start: e.target.value } 
                    })
                  }
                  className="w-32"
                  disabled={disabled}
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={automation.workingHours.end}
                  onChange={(e) => 
                    onUpdate({ 
                      workingHours: { ...automation.workingHours, end: e.target.value } 
                    })
                  }
                  className="w-32"
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>

        {/* Auto Features */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Classificação Automática</p>
              <p className="text-sm text-muted-foreground">
                Classifica tickets por assunto, prioridade e módulo
              </p>
            </div>
            <Switch
              checked={automation.autoClassify}
              onCheckedChange={(autoClassify) => onUpdate({ autoClassify })}
              disabled={disabled || !automation.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Resposta Automática</p>
              <p className="text-sm text-muted-foreground">
                IA responde perguntas frequentes automaticamente
              </p>
            </div>
            <Switch
              checked={automation.autoRespond}
              onCheckedChange={(autoRespond) => onUpdate({ autoRespond })}
              disabled={disabled || !automation.enabled}
            />
          </div>
        </div>

        {disabled && (
          <p className="text-sm text-warning text-center py-2">
            Conecte o WhatsApp para configurar automação
          </p>
        )}
      </CardContent>
    </Card>
  );
}
