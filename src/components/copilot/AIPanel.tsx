import { useState } from "react";
import { Sparkles, Copy, ThumbsUp, ThumbsDown, RefreshCw, Lightbulb, MessageSquare, FileText, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIClassification, AISuggestion, TicketPriority } from "@/types/ticket";

interface AIPanelProps {
  summary?: string;
  classification?: AIClassification;
  suggestions: AISuggestion[];
  isLoading?: boolean;
  onUseSuggestion: (suggestion: AISuggestion) => void;
  onRefresh: () => void;
}

const priorityLabels: Record<TicketPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

const typeIcons = {
  response: MessageSquare,
  action: Lightbulb,
  insight: Sparkles,
};

const typeLabels = {
  response: "Sugestão de resposta",
  action: "Ação sugerida",
  insight: "Insight",
};

export function AIPanel({ 
  summary,
  classification,
  suggestions, 
  isLoading, 
  onUseSuggestion, 
  onRefresh 
}: AIPanelProps) {
  const [editingSuggestion, setEditingSuggestion] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");

  const handleEditStart = (suggestion: AISuggestion) => {
    setEditingSuggestion(suggestion.id);
    setEditedContent(suggestion.content);
  };

  const handleUseEdited = (suggestion: AISuggestion) => {
    onUseSuggestion({ ...suggestion, content: editedContent });
    setEditingSuggestion(null);
    setEditedContent("");
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-copilot/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-copilot" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">IA Copiloto</h3>
              <p className="text-xs text-muted-foreground">Gemini</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRefresh}
            className={cn(isLoading && "animate-spin")}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-copilot/10 flex items-center justify-center mb-3 animate-pulse-soft">
              <Sparkles className="w-5 h-5 text-copilot" />
            </div>
            <p className="text-sm text-muted-foreground">Analisando conversa...</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            {summary && (
              <div className="copilot-suggestion animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-copilot" />
                  <span className="text-xs font-medium text-copilot-foreground">
                    Resumo da conversa
                  </span>
                </div>
                <p className="text-sm text-foreground">{summary}</p>
              </div>
            )}

            {/* Classification */}
            {classification && (
              <div className="copilot-suggestion animate-fade-in">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-copilot" />
                  <span className="text-xs font-medium text-copilot-foreground">
                    Classificação automática
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {Math.round(classification.confidence * 100)}% confiança
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Assunto</p>
                    <p className="font-medium text-foreground">{classification.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="font-medium text-foreground">{classification.type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Módulo</p>
                    <p className="font-medium text-foreground">{classification.module}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prioridade</p>
                    <p className="font-medium text-foreground">{priorityLabels[classification.priority]}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.map((suggestion) => {
              const Icon = typeIcons[suggestion.type];
              const isEditing = editingSuggestion === suggestion.id;

              return (
                <div key={suggestion.id} className="copilot-suggestion animate-fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-copilot" />
                    <span className="text-xs font-medium text-copilot-foreground">
                      {typeLabels[suggestion.type]}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                  
                  {isEditing ? (
                    <textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full p-2 text-sm bg-background border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm text-foreground mb-3">
                      {suggestion.content}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUseEdited(suggestion)}
                          className="flex-1"
                        >
                          Usar editado
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSuggestion(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onUseSuggestion(suggestion)}
                          className="flex-1"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Usar
                        </Button>
                        {suggestion.type === "response" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditStart(suggestion)}
                          >
                            Editar
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>IA apenas auxilia • Não responde ao cliente</span>
        </div>
      </div>
    </div>
  );
}
