import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Package, ChevronRight } from 'lucide-react'

interface HelpCategoryCardProps {
  id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  contentCount: number
}

export function HelpCategoryCard({ id, name, description, color, contentCount }: HelpCategoryCardProps) {
  const bgColor = color || '#6366f1'

  return (
    <Link to={`/help/content?product=${id}`} className="group block">
      <Card className="border-border/60 bg-white overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200 h-full">
        {/* Color bar */}
        <div className="h-2" style={{ backgroundColor: bgColor }} />
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${bgColor}15` }}
            >
              <Package className="w-6 h-6" style={{ color: bgColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground text-lg group-hover:text-primary transition-colors">
                {name}
              </h3>
              {description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {description}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-3 text-sm text-primary font-medium">
                <span>{contentCount} conteúdo{contentCount !== 1 ? 's' : ''}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
