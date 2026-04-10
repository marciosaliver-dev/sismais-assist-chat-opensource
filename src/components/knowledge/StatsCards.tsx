import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Link as LinkIcon, Video, Image as ImageIcon, Database } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface StatsCardsProps {
  stats: {
    total: number
    byType: Record<string, number>
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const iconMap: Record<string, LucideIcon> = {
    text: FileText,
    link: LinkIcon,
    video: Video,
    image: ImageIcon,
  }

  const labelMap: Record<string, string> = {
    text: 'Texto',
    link: 'Links',
    video: 'Vídeos',
    image: 'Imagens',
    pdf: 'PDFs',
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold text-foreground">{stats.total}</span>
          </div>
        </CardContent>
      </Card>

      {Object.entries(stats.byType).map(([type, count]) => {
        const Icon = iconMap[type] || FileText
        return (
          <Card key={type} className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {labelMap[type] || type}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-primary" />
                <span className="text-2xl font-bold text-foreground">{count}</span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
