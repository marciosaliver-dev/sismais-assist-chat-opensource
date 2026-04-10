import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Tables, TablesInsert } from '@/integrations/supabase/types'

type KnowledgeDoc = Tables<'ai_knowledge_base'>
type KnowledgeDocInsert = TablesInsert<'ai_knowledge_base'>

export type SemanticSearchResult = {
  id: string
  title: string
  content: string
  content_type: string
  original_url: string | null
  similarity: number
}

export function useKnowledgeBase() {
  const queryClient = useQueryClient()

  const { data: documents, isLoading } = useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as KnowledgeDoc[]
    },
    placeholderData: keepPreviousData,
  })

  const { data: stats } = useQuery({
    queryKey: ['knowledge-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('ai_knowledge_base')
        .select('content_type, is_active')
        .eq('is_active', true)

      const total = data?.length || 0
      const byType = data?.reduce((acc, doc) => {
        acc[doc.content_type] = (acc[doc.content_type] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return { total, byType }
    }
  })

  const generateEmbedding = async (documentId: string, content: string, title: string) => {
    try {
      const { error } = await supabase.functions.invoke('generate-embedding', {
        body: { document_id: documentId, content, title }
      })
      if (error) {
        console.error('Embedding generation failed:', error)
      } else {
        console.log('Embedding generated for document:', documentId)
      }
    } catch (err) {
      console.error('Embedding generation error:', err)
    }
  }

  const createDocument = useMutation({
    mutationFn: async (doc: KnowledgeDocInsert) => {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .insert(doc)
        .select()
        .single()

      if (error) throw error

      // Fire-and-forget embedding generation
      generateEmbedding(data.id, doc.content, doc.title)

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-stats'] })
    }
  })

  const updateDocument = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<KnowledgeDoc> }) => {
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Re-generate embedding when content or title changes (auto-feed RAG)
      if (updates.content || updates.title) {
        generateEmbedding(
          data.id,
          updates.content || data.content,
          updates.title || data.title
        )
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
    }
  })

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_knowledge_base')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
      queryClient.invalidateQueries({ queryKey: ['knowledge-stats'] })
    }
  })

  const voteDocument = useMutation({
    mutationFn: async ({ id, helpful }: { id: string; helpful: boolean }) => {
      const field = helpful ? 'helpful_count' : 'not_helpful_count'

      const { error } = await supabase.rpc('increment_vote', {
        doc_id: id,
        vote_field: field
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
    }
  })

  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const semanticSearch = useCallback(async (query: string, category?: string) => {
    if (!query.trim()) {
      setSemanticResults(null)
      return
    }
    setIsSearching(true)
    try {
      const { data, error } = await supabase.functions.invoke('rag-search', {
        body: {
          query: query.trim(),
          mode: 'vector',
          category_filter: category && category !== 'all' ? category : null,
          top_k: 20,
          similarity_threshold: 0.5,
        }
      })
      if (error) throw error
      setSemanticResults(data.results || [])
    } catch (err) {
      console.error('Semantic search error:', err)
      setSemanticResults(null)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearSemanticResults = useCallback(() => {
    setSemanticResults(null)
  }, [])

  return {
    documents,
    stats,
    isLoading,
    createDocument,
    updateDocument,
    deleteDocument,
    voteDocument,
    semanticSearch,
    semanticResults,
    isSearching,
    clearSemanticResults
  }
}
