import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface PerformanceChartProps {
  data: Array<{ date: string; ai: number; human: number; total: number }>
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <Card className="border-border overflow-hidden">
      <CardHeader className="bg-[#10293F] text-white pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#45E5E5]" />
          Performance Últimos 7 Dias
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#10293F',
                border: 'none',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '12px',
                boxShadow: '0 10px 15px -3px rgba(16,41,63,0.3)',
              }}
              itemStyle={{ color: '#FFFFFF' }}
              labelStyle={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}
            />
            <Legend />
            <Bar dataKey="ai" name="IA" fill="#45E5E5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="human" name="Humano" fill="#10293F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
