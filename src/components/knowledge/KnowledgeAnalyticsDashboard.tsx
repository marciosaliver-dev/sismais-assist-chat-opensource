import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, TrendingDown, Eye, Brain, 
  FileText, Clock, Star, Search,
  ArrowUp, ArrowDown, Minus,
  BarChart3, Calendar, Filter
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface KnowledgeAnalyticsDashboardProps {
  stats: {
    totalDocs: number
    totalViews: number
    totalSearches: number
    avgSatisfaction: number
  }
  topDocs: { id: string; title: string; views: number }[]
  topSearches: { query: string; count: number }[]
  recentActivity: { id: string; title: string; action: string; time: string }[]
  viewsByDay: { date: string; views: number }[]
}

export function KnowledgeAnalyticsDashboard({
  stats,
  topDocs,
  topSearches,
  recentActivity,
  viewsByDay
}: KnowledgeAnalyticsDashboardProps) {
  const maxViews = Math.max(...viewsByDay.map(d => d.views), 1)

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
    return num.toString()
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Artigos"
          value={stats.totalDocs}
          icon={FileText}
          trend={null}
        />
        <KPICard
          title="Visualizações"
          value={stats.totalViews}
          icon={Eye}
          trend={stats.totalViews > 100 ? 'up' : 'neutral'}
        />
        <KPICard
          title="Buscas"
          value={stats.totalSearches}
          icon={Search}
          trend={stats.totalSearches > 50 ? 'up' : 'neutral'}
        />
        <KPICard
          title="Satisfação"
          value={`${stats.avgSatisfaction}%`}
          icon={Star}
          trend={stats.avgSatisfaction > 70 ? 'up' : stats.avgSatisfaction > 50 ? 'neutral' : 'down'}
          color={stats.avgSatisfaction > 70 ? 'green' : stats.avgSatisfaction > 50 ? 'yellow' : 'red'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Views by Day */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#45E5E5]" />
              Visualizações por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-end gap-1">
              {viewsByDay.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-[#45E5E5]/80 hover:bg-[#45E5E5] rounded-t transition-all"
                    style={{ height: `${(day.views / maxViews) * 100}%`, minHeight: day.views > 0 ? '4px' : '0' }}
                    title={`${day.date}: ${day.views} visualizações`}
                  />
                  <span className="text-[10px] text-muted-foreground rotate-45">
                    {day.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Searches */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4 text-[#45E5E5]" />
              Buscas Mais Populares
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topSearches.slice(0, 8).map((search, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-muted rounded text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{search.query}</span>
                  <Badge variant="outline" className="text-xs">
                    {search.count}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Docs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#45E5E5]" />
              Artigos Mais Acessados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDocs.slice(0, 8).map((doc, i) => (
                <div key={doc.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center bg-muted rounded text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-sm">{doc.title}</span>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    {formatNumber(doc.views)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#45E5E5]" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#45E5E5]" />
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm">{activity.title}</span>
                    <span className="text-xs text-muted-foreground ml-2">{activity.action}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{activity.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface KPICardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend: 'up' | 'down' | 'neutral' | null
  color?: 'green' | 'yellow' | 'red' | 'default'
}

function KPICard({ title, value, icon: Icon, trend, color = 'default' }: KPICardProps) {
  const colorClasses = {
    green: 'text-green-600',
    yellow: 'text-yellow-600', 
    red: 'text-red-600',
    default: 'text-foreground'
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            color === 'green' ? 'bg-green-100' : 
            color === 'yellow' ? 'bg-yellow-100' :
            color === 'red' ? 'bg-red-100' : 'bg-muted'
          }`}>
            <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
          }`}>
            {trend === 'up' && <ArrowUp className="w-3 h-3" />}
            {trend === 'down' && <ArrowDown className="w-3 h-3" />}
            {trend === 'neutral' && <Minus className="w-3 h-3" />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}