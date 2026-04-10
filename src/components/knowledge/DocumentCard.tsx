import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Link as LinkIcon,
  Video,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Trash2,
  Eye,
  FolderOpen,
  BookMarked,
  Brain,
  Clock,
  Users,
  Lock,
  Globe,
  FileEdit,
  Star,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Tables } from '@/integrations/supabase/types'
import type { KnowledgeProduct } from '@/hooks/useKnowledgeProducts'
import type { KnowledgeGroup } from '@/hooks/useKnowledgeGroups'

type KnowledgeDoc = Tables<'ai_knowledge_base'>

interface DocumentCardProps {
  doc: KnowledgeDoc
  onView: (doc: KnowledgeDoc) => void
  onDelete: (id: string) => void
  onVote: (id: string, helpful: boolean) => void
  product?: KnowledgeProduct | null
  group?: KnowledgeGroup | null
}

export function DocumentCard({ doc, onView, onDelete, onVote, product, group }: DocumentCardProps) {
  const navigate = useNavigate()
  const iconMap: Record<string, typeof FileText> = {
    text: FileText,
    link: LinkIcon,
    video: Video,
    image: ImageIcon,
    pdf: FileText,
  }
  const Icon = iconMap[doc.content_type] || FileText

  const categoryLabels: Record<string, string> = {
    faq: 'FAQ',
    tutorial: 'Tutorial',
    troubleshooting: 'Troubleshooting',
    policy: 'Política',
  }

  const templateLabels: Record<string, string> = {
    'how-to': 'Como Fazer',
    'faq': 'FAQ',
    'troubleshooting': 'Problema',
    'tutorial': 'Tutorial',
    'internal-procedure': 'Procedimento',
    'release-notes': 'Release',
  }

  const audienceLabels: Record<string, string> = {
    beginner: 'Iniciante',
    intermediate: 'Intermediário',
    advanced: 'Avançado',
    admin: 'Administrador',
  }

  const visibility = (doc as any).visibility || 'public'
  const isPublic = visibility === 'public'
  const isInternal = visibility === 'internal'
  const isDraft = visibility === 'draft'

  const getRatingStars = () => {
    const rating = (doc as any).avg_rating || 0
    if (rating >= 4.5) return <><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /></>
    if (rating >= 3.5) return <><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 text-muted-foreground" /></>
    if (rating >= 2.5) return <><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /></>
    if (rating >= 1.5) return <><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /></>
    if (rating >= 0.5) return <><Star className="w-3.5 h-3.4 fill-yellow-400 text-yellow-400" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /></>
    return <><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /><Star className="w-3.5 h-3.4 text-muted-foreground" /></>
  }

  return (
    <Card className="border-border bg-card hover:shadow-md transition-all hover:-translate-y-0.5 group">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 border border-primary/20">
            <Icon className="w-5 h-5 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground line-clamp-2 text-base">{doc.title}</h3>

            {doc.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{doc.description}</p>
            )}

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {/* Visibility */}
              {isPublic && (
                <Badge className="text-xs gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                  <Globe className="w-3 h-3" />
                  Público
                </Badge>
              )}
              {isInternal && (
                <Badge className="text-xs gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                  <Lock className="w-3 h-3" />
                  Interno
                </Badge>
              )}
              {isDraft && (
                <Badge className="text-xs gap-1 bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">
                  <FileEdit className="w-3 h-3" />
                  Rascunho
                </Badge>
              )}

              {/* Template badge */}
              {(doc as any).article_template && (
                <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary">
                  <FileText className="w-3 h-3" />
                  {templateLabels[(doc as any).article_template] || (doc as any).article_template}
                </Badge>
              )}

              {/* Audience badge */}
              {(doc as any).audience_tier && (
                <Badge variant="outline" className="text-xs gap-1 border-purple-300 text-purple-700">
                  <Users className="w-3 h-3" />
                  {audienceLabels[(doc as any).audience_tier] || (doc as any).audience_tier}
                </Badge>
              )}

              {/* Product badge */}
              {product && (
                <Badge
                  className="text-xs text-white"
                  style={{ backgroundColor: product.color || '#6366f1' }}
                >
                  {product.name}
                </Badge>
              )}

              {/* Group badge */}
              {group && (
                <Badge variant="outline" className="text-xs gap-1">
                  <FolderOpen className="w-3 h-3" />
                  {group.name}
                </Badge>
              )}

              {/* Category */}
              <Badge variant="secondary" className="text-xs">
                {categoryLabels[doc.category] || doc.category}
              </Badge>

              {/* Tags */}
              {doc.tags?.slice(0, 3).map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
              ))}
              {doc.tags && doc.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">+{doc.tags.length - 3}</Badge>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground">
              {/* Rating */}
              {(doc as any).avg_rating > 0 && (
                <div className="flex items-center gap-1">
                  {getRatingStars()}
                  <span className="ml-1 text-foreground font-medium">
                    {((doc as any).avg_rating || 0).toFixed(1)}
                  </span>
                  <span className="text-muted-foreground">({(doc as any).rating_count || 0})</span>
                </div>
              )}

              {/* Usage count */}
              <span className="flex items-center gap-1">
                <Brain className="w-3 h-3" />
                {doc.usage_count} usos
              </span>

              {/* Read time */}
              {(doc as any).estimated_read_time > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {(doc as any).estimated_read_time} min
                </span>
              )}

              {/* Date */}
              <span>
                {formatDistanceToNow(new Date(doc.created_at!), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>

              {/* Source link */}
              {doc.original_url && (
                <a
                  href={doc.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Fonte
                </a>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(doc)} aria-label="Visualizar documento">
              <Eye className="w-4 h-4" />
            </Button>
            {(doc as any).source_type !== 'manual' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                onClick={() => navigate(`/admin/manuais/new?from=${doc.id}`)}
                aria-label="Criar manual a partir deste documento"
                title="Criar manual"
              >
                <BookMarked className="w-4 h-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(doc.id)} aria-label="Excluir documento">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Voting - subtle footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onVote(doc.id, true)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-green-600 transition-colors"
            >
              <ThumbsUp className="w-4 h-4" />
              <span className="text-xs">{doc.helpful_count}</span>
            </button>
            <button
              onClick={() => onVote(doc.id, false)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-600 transition-colors"
            >
              <ThumbsDown className="w-4 h-4" />
              <span className="text-xs">{doc.not_helpful_count}</span>
            </button>
          </div>
          <Badge variant="outline" className="text-[10px]">{doc.source}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
