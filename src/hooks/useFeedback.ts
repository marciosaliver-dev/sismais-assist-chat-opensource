import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

export type FeedbackType = 'bug' | 'improvement' | 'feature'
export type FeedbackStatus = 'pending' | 'in_review' | 'in_progress' | 'done' | 'rejected'

export interface FeatureRequest {
  id: string
  type: FeedbackType
  title: string
  description: string | null
  images: string[]
  status: FeedbackStatus
  resolution_notes: string | null
  resolved_at: string | null
  requested_by: string | null
  requested_by_name: string
  created_at: string
  updated_at: string
}

export function useFeedbackList(filters?: { type?: FeedbackType; status?: FeedbackStatus }) {
  return useQuery({
    queryKey: ['feature-requests', filters],
    queryFn: async () => {
      let query = supabase
        .from('feature_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as FeatureRequest[]
    },
  })
}

export function useCreateFeedback() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: { type: FeedbackType; title: string; description?: string; images?: string[] }) => {
      const { data, error } = await supabase
        .from('feature_requests')
        .insert({
          type: input.type,
          title: input.title,
          description: input.description || null,
          images: input.images || [],
          requested_by: user?.id,
          requested_by_name: user?.name || 'Usuário',
        })
        .select()
        .single()

      if (error) throw error
      return data as FeatureRequest
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-requests'] })
    },
  })
}

export function useUpdateFeedback() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; status?: FeedbackStatus; resolution_notes?: string }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

      if (input.status) {
        updates.status = input.status
        if (input.status === 'done') {
          updates.resolved_at = new Date().toISOString()
        }
      }
      if (input.resolution_notes !== undefined) {
        updates.resolution_notes = input.resolution_notes
      }

      const { data, error } = await supabase
        .from('feature_requests')
        .update(updates)
        .eq('id', input.id)
        .select()
        .single()

      if (error) throw error
      return data as FeatureRequest
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feature-requests'] })
    },
  })
}

export async function uploadFeedbackImage(file: File): Promise<string | null> {
  const ext = file.name?.split('.').pop() || 'png'
  const fileName = `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('feature-request-images')
    .upload(fileName, file, { contentType: file.type })

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data: urlData } = supabase.storage
    .from('feature-request-images')
    .getPublicUrl(fileName)

  return urlData.publicUrl
}
