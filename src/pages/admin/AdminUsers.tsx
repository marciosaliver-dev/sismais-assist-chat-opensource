import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useSystemUsers } from '@/hooks/useSystemUsers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Plus, Search, Mail, Shield, Users, UserPlus, Clock, Check, X, UserCheck,
  Headphones, Pencil, MessageSquare, Star, Link2, Unlink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SystemUser } from '@/hooks/useSystemUsers'
import { rolePermissions, type RolePermissions } from '@/types/auth'

type HumanAgent = {
  id: string
  name: string
  email: string | null
  is_active: boolean | null
  is_online: boolean | null
  status: string | null
  total_conversations: number | null
  csat_rating: number | null
  created_at: string | null
  user_id: string | null
  max_concurrent_conversations: number | null
  current_conversations_count: number | null
  specialties: string[] | null
}

type NewUserForm = {
  name: string
  email: string
  password: string
  role: 'admin' | 'lider' | 'suporte' | 'comercial'
  create_agent: boolean
  max_simultaneous_chats: number
}

type ApproveForm = {
  role: 'admin' | 'lider' | 'suporte' | 'comercial'
  create_agent: boolean
  max_simultaneous_chats: number
}

type EditAgentForm = {
  name: string
  email: string
  max_concurrent_conversations: number
  specialties: string[]
}

const defaultForm: NewUserForm = {
  name: '',
  email: '',
  password: '',
  role: 'suporte',
  create_agent: true,
  max_simultaneous_chats: 5,
}

const defaultApproveForm: ApproveForm = {
  role: 'suporte',
  create_agent: true,
  max_simultaneous_chats: 5,
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  lider: 'Líder',
  suporte: 'Suporte',
  comercial: 'Comercial',
}

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  lider: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  suporte: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  comercial: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
}

// Permissions definitions
const permissionDefs: { id: keyof RolePermissions; name: string; description: string }[] = [
  { id: 'viewAllTickets', name: 'Ver todos os tickets', description: 'Visualizar todos os tickets do sistema' },
  { id: 'viewLeadTickets', name: 'Ver tickets de leads', description: 'Visualizar conversas de leads' },
  { id: 'manageTickets', name: 'Gerenciar tickets', description: 'Criar, editar e atribuir tickets' },
  { id: 'changeTicketStatus', name: 'Alterar status', description: 'Mudar status do ticket' },
  { id: 'useAICopilot', name: 'Usar IA Copiloto', description: 'Acessar sugestoes e analises da IA' },
  { id: 'viewKnowledgeBase', name: 'Ver base de conhecimento', description: 'Acessar artigos e videos' },
  { id: 'viewFullKnowledgeBase', name: 'Base completa', description: 'Acesso total a base de conhecimento' },
  { id: 'manageKnowledgeBase', name: 'Editar base', description: 'Criar e editar artigos' },
  { id: 'manageUsers', name: 'Gerenciar usuarios', description: 'Adicionar e remover usuarios' },
  { id: 'manageSettings', name: 'Configuracoes', description: 'Alterar configuracoes do sistema' },
  { id: 'viewReports', name: 'Ver relatorios', description: 'Acessar relatorios e metricas' },
]

const rolesDef = [
  { id: 'admin' as const, name: 'Administrador' },
  { id: 'lider' as const, name: 'Líder' },
  { id: 'suporte' as const, name: 'Suporte' },
  { id: 'comercial' as const, name: 'Comercial' },
]

export default function AdminUsers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [editAgentDialogOpen, setEditAgentDialogOpen] = useState(false)
  const [selectedPending, setSelectedPending] = useState<SystemUser | null>(null)
  const [editingAgent, setEditingAgent] = useState<HumanAgent | null>(null)
  const [form, setForm] = useState<NewUserForm>({ ...defaultForm })
  const [approveForm, setApproveForm] = useState<ApproveForm>({ ...defaultApproveForm })
  const [editAgentForm, setEditAgentForm] = useState<EditAgentForm>({ name: '', email: '', max_concurrent_conversations: 5, specialties: [] })
  const [specialtyInput, setSpecialtyInput] = useState('')
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [editingUserForRole, setEditingUserForRole] = useState<SystemUser | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('suporte')

  const { users: approvedUsers, pendingUsers, isLoading: loadingUsers } = useSystemUsers()

  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ['admin-human-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('human_agents')
        .select('id, name, email, is_active, is_online, status, total_conversations, csat_rating, created_at, user_id, max_concurrent_conversations, current_conversations_count, specialties')
        .order('name')
      if (error) throw error
      return data as HumanAgent[]
    },
  })

  const agentByUserId = useMemo(
    () => new Map(agents.filter(a => a.user_id).map(a => [a.user_id!, a])),
    [agents]
  )

  // Agents not linked to any system user (orphan agents)
  const orphanAgents = useMemo(
    () => agents.filter(a => !a.user_id || !approvedUsers.some(u => u.id === a.user_id)),
    [agents, approvedUsers]
  )

  // Stats
  const onlineCount = agents.filter(a => a.is_online).length
  const totalConversations = agents.reduce((s, a) => s + (a.current_conversations_count || 0), 0)

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('human_agents').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-human-agents'] })
      qc.invalidateQueries({ queryKey: ['human-agents'] })
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  const toggleOnline = useMutation({
    mutationFn: async ({ id, is_online }: { id: string; is_online: boolean }) => {
      const { error } = await supabase.from('human_agents').update({
        is_online,
        status: is_online ? 'available' : 'offline',
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-human-agents'] })
      qc.invalidateQueries({ queryKey: ['human-agents'] })
    },
    onError: () => toast.error('Erro ao atualizar status'),
  })

  const updateAgentMut = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<HumanAgent> }) => {
      const { error } = await supabase.from('human_agents').update(updates as any).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-human-agents'] })
      qc.invalidateQueries({ queryKey: ['human-agents'] })
      toast.success('Agente atualizado!')
      setEditAgentDialogOpen(false)
      setEditingAgent(null)
    },
    onError: () => toast.error('Erro ao atualizar agente'),
  })

  const createUser = useMutation({
    mutationFn: async (payload: NewUserForm) => {
      const { data, error } = await supabase.functions.invoke('create-system-user', { body: payload })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      toast.success('Usuario criado com sucesso!')
      qc.invalidateQueries({ queryKey: ['admin-human-agents'] })
      qc.invalidateQueries({ queryKey: ['system-users'] })
      qc.invalidateQueries({ queryKey: ['human-agents'] })
      setCreateDialogOpen(false)
      setForm({ ...defaultForm })
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao criar usuario'),
  })

  const approveUser = useMutation({
    mutationFn: async ({ user_id, ...rest }: ApproveForm & { user_id: string }) => {
      const { data, error } = await supabase.functions.invoke('approve-user', {
        body: { user_id, ...rest },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      toast.success('Usuario aprovado com sucesso!')
      qc.invalidateQueries({ queryKey: ['system-users'] })
      qc.invalidateQueries({ queryKey: ['admin-human-agents'] })
      qc.invalidateQueries({ queryKey: ['human-agents'] })
      setApproveDialogOpen(false)
      setSelectedPending(null)
      setApproveForm({ ...defaultApproveForm })
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao aprovar usuario'),
  })

  const rejectUser = useMutation({
    mutationFn: async (user_id: string) => {
      const { data, error } = await supabase.functions.invoke('reject-user', {
        body: { user_id },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      toast.success('Solicitacao rejeitada.')
      qc.invalidateQueries({ queryKey: ['system-users'] })
      setRejectDialogOpen(false)
      setSelectedPending(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao rejeitar usuario'),
  })

  const updateUserRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('update-user-role', {
        body: { user_id, role },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      toast.success('Papel atualizado com sucesso!')
      qc.invalidateQueries({ queryKey: ['system-users'] })
      setEditRoleDialogOpen(false)
      setEditingUserForRole(null)
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao atualizar papel'),
  })

  const openEditRole = (user: SystemUser) => {
    setEditingUserForRole(user)
    setSelectedRole(user.role)
    setEditRoleDialogOpen(true)
  }

  const handleEditRoleSubmit = () => {
    if (!editingUserForRole) return
    updateUserRole.mutate({ user_id: editingUserForRole.id, role: selectedRole })
  }

  const handleCreateRoleChange = (role: string) => {
    const r = role as NewUserForm['role']
    setForm(prev => ({ ...prev, role: r, create_agent: r === 'suporte' ? true : prev.create_agent }))
  }

  const handleCreateSubmit = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast.error('Preencha todos os campos obrigatorios')
      return
    }
    if (form.password.length < 6) {
      toast.error('A senha deve ter no minimo 6 caracteres')
      return
    }
    createUser.mutate(form)
  }

  const openApprove = (user: SystemUser) => {
    setSelectedPending(user)
    setApproveForm({ ...defaultApproveForm })
    setApproveDialogOpen(true)
  }

  const openReject = (user: SystemUser) => {
    setSelectedPending(user)
    setRejectDialogOpen(true)
  }

  const openEditAgent = (agent: HumanAgent) => {
    setEditingAgent(agent)
    setEditAgentForm({
      name: agent.name,
      email: agent.email || '',
      max_concurrent_conversations: agent.max_concurrent_conversations || 5,
      specialties: agent.specialties || [],
    })
    setSpecialtyInput('')
    setEditAgentDialogOpen(true)
  }

  const handleApproveSubmit = () => {
    if (!selectedPending) return
    approveUser.mutate({ user_id: selectedPending.id, ...approveForm })
  }

  const handleEditAgentSubmit = () => {
    if (!editingAgent) return
    updateAgentMut.mutate({
      id: editingAgent.id,
      updates: {
        name: editAgentForm.name,
        email: editAgentForm.email || null,
        max_concurrent_conversations: editAgentForm.max_concurrent_conversations,
        specialties: editAgentForm.specialties,
      } as any,
    })
  }

  const addSpecialty = () => {
    const tag = specialtyInput.trim()
    if (tag && !editAgentForm.specialties.includes(tag)) {
      setEditAgentForm(f => ({ ...f, specialties: [...f.specialties, tag] }))
      setSpecialtyInput('')
    }
  }

  const removeSpecialty = (tag: string) => {
    setEditAgentForm(f => ({ ...f, specialties: f.specialties.filter(s => s !== tag) }))
  }

  const filteredApproved = approvedUsers.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredPending = pendingUsers.filter(u =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredOrphanAgents = orphanAgents.filter(a =>
    !search ||
    a.name?.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  )

  const isLoading = loadingUsers || loadingAgents

  const getLoadPercentage = (agent: HumanAgent) => {
    const max = agent.max_concurrent_conversations || 5
    const current = agent.current_conversations_count || 0
    return Math.min(100, Math.round((current / max) * 100))
  }

  const getStatusBadge = (agent: HumanAgent) => {
    if (agent.is_active === false) return <Badge variant="outline" className="text-muted-foreground text-[10px]">Inativo</Badge>
    if (!agent.is_online) return <Badge variant="outline" className="text-muted-foreground text-[10px]">Offline</Badge>
    switch (agent.status) {
      case 'available': return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 text-[10px]">Online</Badge>
      case 'busy': return <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 text-[10px]">Ocupado</Badge>
      case 'away': return <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px]">Ausente</Badge>
      default: return <Badge variant="outline" className="text-muted-foreground text-[10px]">Offline</Badge>
    }
  }

  // Render a team member row (user + agent info combined)
  const renderTeamRow = (user: SystemUser, agent: HumanAgent | undefined) => {
    const load = agent ? getLoadPercentage(agent) : 0
    return (
      <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
              {agent?.is_online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{user.name || '--'}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge className={cn('text-xs', roleBadgeClass[user.role] || '')}>
            {roleLabels[user.role] || user.role}
          </Badge>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          {agent ? (
            <div className="flex items-center gap-2">
              {getStatusBadge(agent)}
              {(agent.specialties || []).length > 0 && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {(agent.specialties || []).slice(0, 2).join(', ')}
                </span>
              )}
            </div>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground">
              <Unlink className="w-3 h-3" />
              Sem agente
            </Badge>
          )}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          {agent ? (
            <div className="flex items-center gap-2 min-w-[120px]">
              <Progress value={load} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {agent.current_conversations_count || 0}/{agent.max_concurrent_conversations || 5}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">--</span>
          )}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          {agent ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`active-${agent.id}`} className="text-[10px] text-muted-foreground">Ativo</Label>
                <Switch
                  id={`active-${agent.id}`}
                  checked={agent.is_active !== false}
                  onCheckedChange={v => toggleActive.mutate({ id: agent.id, is_active: v })}
                  className="scale-75"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`online-${agent.id}`} className="text-[10px] text-muted-foreground">Online</Label>
                <Switch
                  id={`online-${agent.id}`}
                  checked={agent.is_online ?? false}
                  onCheckedChange={v => toggleOnline.mutate({ id: agent.id, is_online: v })}
                  disabled={agent.is_active === false}
                  className="scale-75"
                />
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">--</span>
          )}
        </td>
        <td className="px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRole(user)} title="Alterar papel">
              <Shield className="w-3.5 h-3.5" />
            </Button>
            {agent && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAgent(agent)} title="Editar agente">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  // Render an orphan agent row (agent without user)
  const renderOrphanAgentRow = (agent: HumanAgent) => {
    const load = getLoadPercentage(agent)
    return (
      <tr key={agent.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors bg-amber-50/30 dark:bg-amber-900/5">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-semibold text-sm">
                {agent.name.charAt(0).toUpperCase()}
              </div>
              {agent.is_online && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm text-foreground truncate">{agent.name}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Headphones className="w-3 h-3 shrink-0" />
                <span>Agente sem usuario vinculado</span>
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className="text-xs text-amber-600 dark:text-amber-400 border-amber-300">
            Agente
          </Badge>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <div className="flex items-center gap-2">
            {getStatusBadge(agent)}
            {(agent.specialties || []).length > 0 && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {(agent.specialties || []).slice(0, 2).join(', ')}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <div className="flex items-center gap-2 min-w-[120px]">
            <Progress value={load} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {agent.current_conversations_count || 0}/{agent.max_concurrent_conversations || 5}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`active-o-${agent.id}`} className="text-[10px] text-muted-foreground">Ativo</Label>
              <Switch
                id={`active-o-${agent.id}`}
                checked={agent.is_active !== false}
                onCheckedChange={v => toggleActive.mutate({ id: agent.id, is_active: v })}
                className="scale-75"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor={`online-o-${agent.id}`} className="text-[10px] text-muted-foreground">Online</Label>
              <Switch
                id={`online-o-${agent.id}`}
                checked={agent.is_online ?? false}
                onCheckedChange={v => toggleOnline.mutate({ id: agent.id, is_online: v })}
                disabled={agent.is_active === false}
                className="scale-75"
              />
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-right">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAgent(agent)}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </td>
      </tr>
    )
  }

  return (
    <div className="page-container">
      <div className="page-content">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Equipe & Acessos</h1>
              <p className="text-sm text-muted-foreground">
                {approvedUsers.length} usuario(s) &middot; {agents.length} agente(s) &middot; {onlineCount} online &middot; {totalConversations} conversa(s)
                {pendingUsers.length > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">
                    &middot; {pendingUsers.length} aguardando aprovacao
                  </span>
                )}
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Usuario
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="team">
          <TabsList>
            <TabsTrigger value="team" className="gap-2">
              <Headphones className="w-4 h-4" />
              Equipe
              <Badge variant="secondary" className="ml-1">{approvedUsers.length + orphanAgents.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pendentes
              {pendingUsers.length > 0 && (
                <Badge className="ml-1 bg-amber-500 text-white">{pendingUsers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <Shield className="w-4 h-4" />
              Permissoes
            </TabsTrigger>
          </TabsList>

          {/* ========== TEAM TAB ========== */}
          <TabsContent value="team" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Membro</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Papel</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Status / Especialidades</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Carga</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Controles</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApproved.length === 0 && filteredOrphanAgents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                          {search ? 'Nenhum membro encontrado.' : 'Nenhum membro na equipe.'}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {filteredApproved.map(user => renderTeamRow(user, agentByUserId.get(user.id)))}
                        {filteredOrphanAgents.length > 0 && (
                          <>
                            <tr>
                              <td colSpan={6} className="px-4 py-2 bg-muted/20">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                  Agentes sem usuario vinculado ({filteredOrphanAgents.length})
                                </span>
                              </td>
                            </tr>
                            {filteredOrphanAgents.map(renderOrphanAgentRow)}
                          </>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ========== PENDING TAB ========== */}
          <TabsContent value="pending" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="bg-card rounded-xl border border-dashed border-border flex flex-col items-center justify-center py-12 gap-3">
                <Clock className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {search ? 'Nenhuma solicitacao encontrada.' : 'Nenhuma solicitacao de acesso pendente.'}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Solicitante</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Status</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPending.map(user => (
                      <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 font-semibold text-sm shrink-0">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm text-foreground truncate">{user.name || '--'}</p>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3 shrink-0" />
                                <span className="truncate">{user.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 hidden sm:table-cell">
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs gap-1">
                            <Clock className="w-3 h-3" />
                            Aguardando aprovacao
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                              onClick={() => openReject(user)}
                            >
                              <X className="w-3.5 h-3.5" />
                              Rejeitar
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              onClick={() => openApprove(user)}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Aprovar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* ========== PERMISSIONS TAB ========== */}
          <TabsContent value="permissions" className="mt-4">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Permissao
                    </th>
                    {rolesDef.map(role => (
                      <th key={role.id} className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center justify-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" />
                          {role.name}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissionDefs.map(perm => (
                    <tr key={perm.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm text-foreground">{perm.name}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </td>
                      {rolesDef.map(role => (
                        <td key={role.id} className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            {rolePermissions[role.id][perm.id] ? (
                              <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center">
                                <Check className="w-3.5 h-3.5 text-green-600" />
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground mt-4">
              <p>
                <strong>Nota:</strong> As permissoes sao fixas por funcao. Permissoes personalizadas serao adicionadas em versoes futuras.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ========== CREATE USER DIALOG ========== */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Novo Usuario
            </DialogTitle>
            <DialogDescription>
              Crie um usuario diretamente com acesso imediato ao sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome *</Label>
              <Input id="user-name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">E-mail *</Label>
              <Input id="user-email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Senha *</Label>
              <Input id="user-password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Minimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={form.role} onValueChange={handleCreateRoleChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin"><div className="flex items-center gap-2"><Shield className="w-4 h-4 text-destructive" /> Administrador</div></SelectItem>
                  <SelectItem value="lider"><div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Líder</div></SelectItem>
                  <SelectItem value="suporte"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Suporte</div></SelectItem>
                  <SelectItem value="comercial"><div className="flex items-center gap-2"><Mail className="w-4 h-4 text-accent-foreground" /> Comercial</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Criar como Agente Humano</p>
                <p className="text-xs text-muted-foreground">Vincular ao sistema de atendimento</p>
              </div>
              <Switch checked={form.create_agent} onCheckedChange={v => setForm(p => ({ ...p, create_agent: v }))} />
            </div>
            {form.create_agent && (
              <div className="space-y-2">
                <Label htmlFor="max-chats">Max. Conversas Simultaneas</Label>
                <Input id="max-chats" type="number" min={1} max={50} value={form.max_simultaneous_chats} onChange={e => setForm(p => ({ ...p, max_simultaneous_chats: parseInt(e.target.value) || 5 }))} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubmit} disabled={createUser.isPending}>
              {createUser.isPending ? <Spinner className="mr-2" /> : null}
              Criar Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== APPROVE DIALOG ========== */}
      <Dialog open={approveDialogOpen} onOpenChange={open => { setApproveDialogOpen(open); if (!open) setSelectedPending(null) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-500" />
              Aprovar Acesso
            </DialogTitle>
            <DialogDescription>Defina o papel e as configuracoes para o usuario.</DialogDescription>
          </DialogHeader>
          {selectedPending && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                  {(selectedPending.name || selectedPending.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{selectedPending.name || '--'}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedPending.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Papel</Label>
                <Select value={approveForm.role} onValueChange={v => setApproveForm(p => ({ ...p, role: v as ApproveForm['role'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin"><div className="flex items-center gap-2"><Shield className="w-4 h-4 text-destructive" /> Administrador</div></SelectItem>
                    <SelectItem value="lider"><div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Líder</div></SelectItem>
                    <SelectItem value="suporte"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Suporte</div></SelectItem>
                    <SelectItem value="comercial"><div className="flex items-center gap-2"><Mail className="w-4 h-4 text-accent-foreground" /> Comercial</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Criar como Agente Humano</p>
                  <p className="text-xs text-muted-foreground">Vincular ao sistema de atendimento</p>
                </div>
                <Switch checked={approveForm.create_agent} onCheckedChange={v => setApproveForm(p => ({ ...p, create_agent: v }))} />
              </div>
              {approveForm.create_agent && (
                <div className="space-y-2">
                  <Label>Max. Conversas Simultaneas</Label>
                  <Input type="number" min={1} max={50} value={approveForm.max_simultaneous_chats} onChange={e => setApproveForm(p => ({ ...p, max_simultaneous_chats: parseInt(e.target.value) || 5 }))} />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveDialogOpen(false); setSelectedPending(null) }}>Cancelar</Button>
            <Button onClick={handleApproveSubmit} disabled={approveUser.isPending} className="bg-green-600 hover:bg-green-700">
              {approveUser.isPending ? <Spinner className="mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
              Aprovar Acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== REJECT DIALOG ========== */}
      <Dialog open={rejectDialogOpen} onOpenChange={open => { setRejectDialogOpen(open); if (!open) setSelectedPending(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="w-5 h-5" />
              Rejeitar Solicitacao
            </DialogTitle>
            <DialogDescription>
              {selectedPending && (
                <>
                  Tem certeza que deseja rejeitar o acesso de{' '}
                  <strong>{selectedPending.name || selectedPending.email}</strong>?
                  O usuario nao conseguira acessar o sistema.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setSelectedPending(null) }}>Cancelar</Button>
            <Button variant="destructive" disabled={rejectUser.isPending} onClick={() => selectedPending && rejectUser.mutate(selectedPending.id)}>
              {rejectUser.isPending ? <Spinner className="mr-2" /> : null}
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== EDIT AGENT DIALOG ========== */}
      <Dialog open={editAgentDialogOpen} onOpenChange={open => { setEditAgentDialogOpen(open); if (!open) setEditingAgent(null) }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Agente
            </DialogTitle>
            <DialogDescription>Altere as configuracoes do agente de atendimento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editAgentForm.name} onChange={e => setEditAgentForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editAgentForm.email} onChange={e => setEditAgentForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Max. Conversas Simultaneas</Label>
              <Input
                type="number" min={1} max={50}
                value={editAgentForm.max_concurrent_conversations}
                onChange={e => setEditAgentForm(f => ({ ...f, max_concurrent_conversations: parseInt(e.target.value) || 5 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Especialidades</Label>
              <div className="flex gap-2">
                <Input
                  value={specialtyInput}
                  onChange={e => setSpecialtyInput(e.target.value)}
                  placeholder="Ex: vendas, suporte..."
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty() } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addSpecialty}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {editAgentForm.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editAgentForm.specialties.map(s => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s}
                      <button onClick={() => removeSpecialty(s)}><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditAgentDialogOpen(false); setEditingAgent(null) }}>Cancelar</Button>
            <Button onClick={handleEditAgentSubmit} disabled={!editAgentForm.name || updateAgentMut.isPending}>
              {updateAgentMut.isPending ? <Spinner className="mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== EDIT ROLE DIALOG ========== */}
      <Dialog open={editRoleDialogOpen} onOpenChange={open => { setEditRoleDialogOpen(open); if (!open) setEditingUserForRole(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Alterar Papel
            </DialogTitle>
            <DialogDescription>Defina o papel e as permissoes do usuario no sistema.</DialogDescription>
          </DialogHeader>
          {editingUserForRole && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                  {(editingUserForRole.name || editingUserForRole.email).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{editingUserForRole.name || '--'}</p>
                  <p className="text-xs text-muted-foreground truncate">{editingUserForRole.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Papel atual</Label>
                <Badge className={cn('text-xs', roleBadgeClass[editingUserForRole.role] || '')}>
                  {roleLabels[editingUserForRole.role] || editingUserForRole.role}
                </Badge>
              </div>
              <div className="space-y-2">
                <Label>Novo papel</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin"><div className="flex items-center gap-2"><Shield className="w-4 h-4 text-destructive" /> Administrador</div></SelectItem>
                    <SelectItem value="lider"><div className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Líder</div></SelectItem>
                    <SelectItem value="suporte"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Suporte</div></SelectItem>
                    <SelectItem value="comercial"><div className="flex items-center gap-2"><Mail className="w-4 h-4 text-accent-foreground" /> Comercial</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Permissoes do papel selecionado:</p>
                <div className="flex flex-wrap gap-1.5">
                  {permissionDefs
                    .filter(p => rolePermissions[selectedRole as keyof typeof rolePermissions]?.[p.id])
                    .map(p => (
                      <Badge key={p.id} variant="secondary" className="text-[10px]">{p.name}</Badge>
                    ))
                  }
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditRoleDialogOpen(false); setEditingUserForRole(null) }}>Cancelar</Button>
            <Button
              onClick={handleEditRoleSubmit}
              disabled={updateUserRole.isPending || selectedRole === editingUserForRole?.role}
            >
              {updateUserRole.isPending ? <Spinner className="mr-2" /> : null}
              Salvar Papel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
