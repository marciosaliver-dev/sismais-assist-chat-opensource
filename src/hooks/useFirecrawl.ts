import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface CrawlPage {
  url: string
  title: string
  markdown: string
}

export function useFirecrawl() {
  const [loading, setLoading] = useState(false)

  const crawlUrl = async (url: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url, options: { formats: ['markdown'] } },
      })

      if (error) throw new Error(error.message)
      if (!data?.success) throw new Error(data?.error || 'Falha ao crawlear')

      const markdown = data.data?.markdown || data.markdown || ''
      const title = data.data?.metadata?.title || data.metadata?.title || url

      return { title, content: markdown, markdown }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao crawlear URL')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const crawlSite = async (url: string, limit: number = 10, maxDepth?: number): Promise<CrawlPage[]> => {
    setLoading(true)
    try {
      const options: { limit: number; maxDepth?: number } = { limit }
      if (maxDepth !== undefined) options.maxDepth = maxDepth
      const { data, error } = await supabase.functions.invoke('firecrawl-crawl', {
        body: { url, options },
      })

      if (error) throw new Error(error.message)
      if (!data?.success) throw new Error(data?.error || 'Falha no crawl recursivo')

      return data.pages as CrawlPage[]
    } catch (error: any) {
      toast.error(error.message || 'Erro no crawl recursivo')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const checkExistingUrls = async (urls: string[]): Promise<{ id: string; title: string; original_url: string; updated_at: string }[]> => {
    if (urls.length === 0) return []
    const { data } = await supabase
      .from('ai_knowledge_base')
      .select('id, title, original_url, updated_at')
      .in('original_url', urls)
      .eq('is_active', true)
    return (data || []) as { id: string; title: string; original_url: string; updated_at: string }[]
  }

  return { crawlUrl, crawlSite, checkExistingUrls, loading }
}
