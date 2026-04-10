import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

const db = supabase as any

export interface Skill {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  category: string | null
  prompt_instructions: string | null
  trigger_keywords: string[] | null
  trigger_intents: string[] | null
  tool_ids: string[] | null
  auto_activate: boolean
  is_active: boolean
  is_system: boolean
  sort_order: number | null
  created_at: string | null
  updated_at: string | null
}

export type SkillInsert = Partial<Skill> & { name: string; slug: string }

export interface SkillAssignment {
  id: string
  agent_id: string
  skill_id: string
  is_enabled: boolean
  priority: number | null
  custom_config: any
  created_at: string | null
}

export type SkillAssignmentInsert = Partial<SkillAssignment> & { agent_id: string; skill_id: string }

export function useAgentSkills() {
  const queryClient = useQueryClient()

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: ['agent-skills'],
    queryFn: async () => {
      const { data, error } = await db
        .from('ai_agent_skills')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      return (data ?? []) as Skill[]
    }
  })

  const createSkill = useMutation({
    mutationFn: async (skill: SkillInsert) => {
      const { data, error } = await db
        .from('ai_agent_skills')
        .insert(skill)
        .select()
        .single()

      if (error) throw error
      return data as Skill
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skills'] })
    }
  })

  const updateSkill = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Skill> & { id: string }) => {
      const { data, error } = await db
        .from('ai_agent_skills')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Skill
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skills'] })
    }
  })

  const deleteSkill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('ai_agent_skills')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skills'] })
      queryClient.invalidateQueries({ queryKey: ['agent-skill-assignments'] })
    }
  })

  return {
    skills: skills ?? [],
    skillsLoading,
    createSkill,
    updateSkill,
    deleteSkill,
  }
}

export function useAgentSkillAssignments(agentId: string | undefined) {
  const queryClient = useQueryClient()

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['agent-skill-assignments', agentId],
    queryFn: async () => {
      if (!agentId) return []

      const { data, error } = await db
        .from('ai_agent_skill_assignments')
        .select('*, ai_agent_skills(*)')
        .eq('agent_id', agentId)
        .order('priority', { ascending: true })

      if (error) throw error
      return (data ?? []) as any[]
    },
    enabled: !!agentId
  })

  const toggleSkill = useMutation({
    mutationFn: async ({ agentId, skillId, isEnabled }: { agentId: string; skillId: string; isEnabled: boolean }) => {
      const { data: existing } = await db
        .from('ai_agent_skill_assignments')
        .select('id, is_enabled')
        .eq('agent_id', agentId)
        .eq('skill_id', skillId)
        .maybeSingle()

      if (existing) {
        const { error } = await db
          .from('ai_agent_skill_assignments')
          .update({ is_enabled: isEnabled })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await db
          .from('ai_agent_skill_assignments')
          .insert({ agent_id: agentId, skill_id: skillId, is_enabled: isEnabled })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skill-assignments', agentId] })
    }
  })

  const assignSkill = useMutation({
    mutationFn: async (assignment: SkillAssignmentInsert) => {
      const { data, error } = await db
        .from('ai_agent_skill_assignments')
        .upsert(assignment, { onConflict: 'agent_id,skill_id' })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skill-assignments', agentId] })
    }
  })

  const removeSkill = useMutation({
    mutationFn: async ({ agentId, skillId }: { agentId: string; skillId: string }) => {
      const { error } = await db
        .from('ai_agent_skill_assignments')
        .delete()
        .eq('agent_id', agentId)
        .eq('skill_id', skillId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skill-assignments', agentId] })
    }
  })

  const updateAssignment = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SkillAssignment> & { id: string }) => {
      const { data, error } = await db
        .from('ai_agent_skill_assignments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-skill-assignments', agentId] })
    }
  })

  return {
    assignments: assignments ?? [],
    assignmentsLoading,
    toggleSkill,
    assignSkill,
    removeSkill,
    updateAssignment,
  }
}
