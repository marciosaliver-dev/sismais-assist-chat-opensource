import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, BookOpen, TrendingUp, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LearningStats {
  newKnowledgeThisWeek: number
  avgConfidenceThisWeek: number
  avgConfidenceLastWeek: number
  aiResolutionRateThisWeek: number
  aiResolutionRateLastWeek: number
  topLearnedTopics: string[]
  escalationReduction: number
}

function useLearningStats() {
  return useQuery<LearningStats>({
    queryKey: ['ai-learning-stats'],
    queryFn: async () => {
      const now = new Date()
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const weekAgoISO = weekAgo.toISOString()
      const twoWeeksAgoISO = twoWeeksAgo.toISOString()

      const [
        kbThisWeek, confThisWeek, confLastWeek,
        resolvedThisWeek, totalThisWeek, resolvedLastWeek, totalLastWeek,
        recentKBTopics,
      ] = await Promise.all([
        supabase.from('ai_knowledge_base').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoISO),
        supabase.from('ai_messages').select('confidence').eq('role', 'assistant').gte('created_at', weekAgoISO).not('confidence', 'is', null).limit(500),
        supabase.from('ai_messages').select('confidence').eq('role', 'assistant').gte('created_at', twoWeeksAgoISO).lt('created_at', weekAgoISO).not('confidence', 'is', null).limit(500),
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('handler_type', 'ai').in('status', ['finalizado', 'resolvido']).gte('created_at', weekAgoISO),
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).gte('created_at', weekAgoISO),
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('handler_type', 'ai').in('status', ['finalizado', 'resolvido']).gte('created_at', twoWeeksAgoISO).lt('created_at', weekAgoISO),
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).gte('created_at', twoWeeksAgoISO).lt('created_at', weekAgoISO),
        supabase.from('ai_knowledge_base').select('title').gte('created_at', weekAgoISO).order('created_at', { ascending: false }).limit(5),
      ])

      const avgConf = (msgs: any[]) => {
        if (!msgs || msgs.length === 0) return 0
        return msgs.reduce((sum, m) => sum + (m.confidence || 0), 0) / msgs.length
      }

      const thisWeekResolved = resolvedThisWeek.count || 0
      const thisWeekTotal = totalThisWeek.count || 0
      const lastWeekResolved = resolvedLastWeek.count || 0
      const lastWeekTotal = totalLastWeek.count || 0

      const aiRateThisWeek = thisWeekTotal > 0 ? (thisWeekResolved / thisWeekTotal) * 100 : 0
      const aiRateLastWeek = lastWeekTotal > 0 ? (lastWeekResolved / lastWeekTotal) * 100 : 0

      return {
        newKnowledgeThisWeek: kbThisWeek.count || 0,
        avgConfidenceThisWeek: avgConf(confThisWeek.data || []),
        avgConfidenceLastWeek: avgConf(confLastWeek.data || []),
        aiResolutionRateThisWeek: aiRateThisWeek,
        aiResolutionRateLastWeek: aiRateLastWeek,
        topLearnedTopics: (recentKBTopics.data || []).map((d: any) => d.title).filter(Boolean),
        escalationReduction: aiRateLastWeek > 0 ? aiRateThisWeek - aiRateLastWeek : 0,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function AILearningInsights() {
  const { data: stats, isLoading } = useLearningStats()

  if (isLoading || !stats) return null

  const confidenceDelta = stats.avgConfidenceThisWeek - stats.avgConfidenceLastWeek
  const resolutionDelta = stats.aiResolutionRateThisWeek - stats.aiResolutionRateLastWeek

  return (
    <Card className="border-[rgba(69,229,229,0.3)] bg-gradient-to-br from-[#E8F9F9] to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <div className="w-8 h-8 rounded-lg bg-[#E8F9F9] border border-[rgba(69,229,229,0.4)] flex items-center justify-center">
            <Brain className="w-4 h-4 text-[#10293F]" />
          </div>
          <span className="text-[#10293F] dark:text-foreground font-semibold">Aprendizado da IA esta semana</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricPill icon={BookOpen} label="Novos docs" value={String(stats.newKnowledgeThisWeek)} subtitle="na knowledge base" />
          <MetricPill icon={TrendingUp} label="Confiança média" value={`${Math.round(stats.avgConfidenceThisWeek * 100)}%`} delta={confidenceDelta} />
          <MetricPill icon={Brain} label="Resolução IA" value={`${Math.round(stats.aiResolutionRateThisWeek)}%`} delta={resolutionDelta} />
          <MetricPill
            icon={Lightbulb}
            label="Tendência"
            value={resolutionDelta >= 0 ? 'Melhorando' : 'Atenção'}
            valueClassName={resolutionDelta >= 0 ? 'text-[#16A34A]' : 'text-[#FFB800]'}
          />
        </div>

        {stats.topLearnedTopics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[#666666] mb-1.5">Tópicos aprendidos recentemente:</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.topLearnedTopics.map((topic, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-[#E8F9F9] text-[#10293F] border border-[rgba(69,229,229,0.3)]">
                  {topic.length > 40 ? topic.substring(0, 40) + '...' : topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MetricPill({
  icon: Icon, label, value, subtitle, delta, valueClassName,
}: {
  icon: any; label: string; value: string; subtitle?: string; delta?: number; valueClassName?: string
}) {
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-[#F8FAFC] border border-[#E5E5E5]">
      <Icon className="w-4 h-4 text-[#666666] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-[#666666]">{label}</p>
        <p className={cn("text-sm font-semibold", valueClassName || "text-[#10293F] dark:text-foreground")}>{value}</p>
        {subtitle && <p className="text-xs text-[#666666]">{subtitle}</p>}
        {delta !== undefined && delta !== 0 && (
          <p className={cn("text-xs font-medium", delta > 0 ? "text-[#16A34A]" : "text-[#DC2626]")}>
            {delta > 0 ? '+' : ''}{(delta * (label.includes('Confiança') ? 100 : 1)).toFixed(1)}pp vs semana anterior
          </p>
        )}
      </div>
    </div>
  )
}
