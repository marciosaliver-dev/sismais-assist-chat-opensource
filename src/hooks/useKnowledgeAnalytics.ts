import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useKnowledgeAnalytics() {
  const queryClient = useQueryClient()

  const trackEvent = useMutation({
    mutationFn: async (event: {
      documentId: string
      eventType: 'view' | 'search' | 'helpful' | 'not_helpful' | 'copy' | 'share' | 'print'
      searchQuery?: string
      source?: 'widget' | 'agent' | 'internal' | 'api' | 'search'
    }) => {
      const { data, error } = await supabase
        .from('ai_knowledge_base_analytics')
        .insert({
          document_id: event.documentId,
          event_type: event.eventType,
          source: event.source || 'internal',
          search_query: event.searchQuery
        })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-analytics'] })
    }
  })

  const getDocumentStats = async (documentId: string) => {
    const { data, error } = await supabase
      .from('ai_knowledge_base_analytics')
      .select('event_type, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })

    if (error) throw error

    const views = data?.filter(d => d.event_type === 'view').length || 0
    const helpful = data?.filter(d => d.event_type === 'helpful').length || 0
    const notHelpful = data?.filter(d => d.event_type === 'not_helpful').length || 0
    
    return {
      views,
      helpful,
      notHelpful,
      total: data?.length || 0,
      satisfactionRate: (helpful + notHelpful) > 0 
        ? Math.round((helpful / (helpful + notHelpful)) * 100) 
        : 0
    }
  }

  const getPopularSearches = async (limit = 10) => {
    const { data, error } = await supabase
      .from('ai_knowledge_base_analytics')
      .select('search_query, created_at')
      .not('search_query', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const searchCounts: Record<string, number> = {}
    data?.forEach(d => {
      if (d.search_query) {
        const q = d.search_query.toLowerCase().trim()
        searchCounts[q] = (searchCounts[q] || 0) + 1
      }
    })

    return Object.entries(searchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }))
  }

  const getTopViewedDocs = async (limit = 10) => {
    const { data, error } = await supabase
      .from('ai_knowledge_base_analytics')
      .select('document_id, event_type')
      .eq('event_type', 'view')

    if (error) throw error

    const viewCounts: Record<string, number> = {}
    data?.forEach(d => {
      viewCounts[d.document_id] = (viewCounts[d.document_id] || 0) + 1
    })

    const docIds = Object.entries(viewCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id)

    if (docIds.length === 0) return []

    const { data: docs } = await supabase
      .from('ai_knowledge_base')
      .select('id, title, usage_count')
      .in('id', docIds)

    return docs?.map(doc => ({
      ...doc,
      views: viewCounts[doc.id] || 0
    })) || []
  }

  return {
    trackEvent,
    getDocumentStats,
    getPopularSearches,
    getTopViewedDocs
  }
}

export function useKnowledgeVersions(documentId: string) {
  const { data: versions, isLoading } = useQuery({
    queryKey: ['knowledge-versions', documentId],
    queryFn: async () => {
      if (!documentId) return []
      const { data, error } = await supabase
        .from('ai_knowledge_base_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!documentId
  })

  const restoreVersion = useMutation({
    mutationFn: async (versionId: string) => {
      // Get the version snapshot
      const { data: version, error: getError } = await supabase
        .from('ai_knowledge_base_versions')
        .select('title_snapshot, content_snapshot')
        .eq('id', versionId)
        .single()

      if (getError) throw getError

      // Update the main document
      const { data, error } = await supabase
        .from('ai_knowledge_base')
        .update({
          title: version.title_snapshot,
          content: version.content_snapshot
        })
        .eq('id', documentId)
        .select()
        .single()

      if (error) throw error
      return data
    }
  })

  return {
    versions,
    isLoading,
    restoreVersion
  }
}

export function useKnowledgeApprovals(documentId?: string) {
  const queryClient = useQueryClient()

  const requestApproval = useMutation({
    mutationFn: async (data: { documentId: string; comments?: string }) => {
      const { data: result, error } = await supabase
        .from('knowledge_approvals')
        .insert({
          document_id: data.documentId,
          requested_by: (await supabase.auth.getUser()).data.user?.id,
          comments: data.comments,
          status: 'pending'
        })
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-approvals'] })
    }
  })

  const approveDocument = useMutation({
    mutationFn: async (approvalId: string) => {
      const { data, error } = await supabase
        .from('knowledge_approvals')
        .update({
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          status: 'approved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', approvalId)
        .select()
        .single()

      if (error) throw error
      return data
    }
  })

  const rejectDocument = useMutation({
    mutationFn: async (data: { approvalId: string; reason: string }) => {
      const { data: result, error } = await supabase
        .from('knowledge_approvals')
        .update({
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          status: 'rejected',
          rejection_reason: data.reason,
          resolved_at: new Date().toISOString()
        })
        .eq('id', data.approvalId)
        .select()
        .single()

      if (error) throw error
      return result
    }
  })

  return {
    requestApproval,
    approveDocument,
    rejectDocument
  }
}

export function useKnowledgeComments(documentId: string) {
  const queryClient = useQueryClient()

  const { data: comments, isLoading } = useQuery({
    queryKey: ['knowledge-comments', documentId],
    queryFn: async () => {
      if (!documentId) return []
      const { data, error } = await supabase
        .from('knowledge_comments')
        .select('*, user:user_id(email)')
        .eq('document_id', documentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!documentId
  })

  const addComment = useMutation({
    mutationFn: async (data: { documentId: string; content: string; isInternal?: boolean }) => {
      const { data: result, error } = await supabase
        .from('knowledge_comments')
        .insert({
          document_id: data.documentId,
          content: data.content,
          is_internal: data.isInternal || false,
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-comments', documentId] })
    }
  })

  return {
    comments,
    isLoading,
    addComment
  }
}