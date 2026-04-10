/**
 * Utilitário de timezone Brasil (America/Sao_Paulo) para o sistema Sismais.
 *
 * Fornece:
 * - Data/hora atual em horário de Brasília
 * - Verificação de feriados (via tabela business_holidays)
 * - Verificação de horário comercial
 * - Cálculo do próximo dia útil
 *
 * Brasil não pratica horário de verão desde 2019 — America/Sao_Paulo = UTC-3 constante.
 */

// ── Tipos ──

export interface BrazilNow {
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  time: string
  /** 0=domingo, 6=sábado */
  dayOfWeek: number
  dayName: string
  hour: number
  minute: number
  year: number
  month: number
  day: number
}

export interface HolidayCheck {
  isHoliday: boolean
  name?: string
}

export interface BusinessHoursStatus {
  isOpen: boolean
  reason: string
}

// ── Funções principais ──

const DAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/**
 * Retorna a data/hora atual no fuso horário de Brasília (America/Sao_Paulo).
 */
export function getNowBrazil(): BrazilNow {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  })

  const parts = formatter.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''

  const year = parseInt(get('year'))
  const month = parseInt(get('month'))
  const day = parseInt(get('day'))
  const hour = parseInt(get('hour'))
  const minute = parseInt(get('minute'))

  // Calcular dia da semana a partir da data em SP (pode diferir do UTC)
  const spDate = new Date(year, month - 1, day)
  const dayOfWeek = spDate.getDay()

  const pad = (n: number) => String(n).padStart(2, '0')

  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${pad(minute)}`,
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    hour,
    minute,
    year,
    month,
    day,
  }
}

/**
 * Formata data/hora de Brasília para injeção no system prompt da IA.
 * Ex: "Terça-feira, 18 de março de 2026, 14:35 (horário de Brasília)"
 */
export function formatBrazilDateTime(): string {
  const now = getNowBrazil()
  const dayCapitalized = now.dayName.charAt(0).toUpperCase() + now.dayName.slice(1)
  return `${dayCapitalized}, ${now.day} de ${MONTH_NAMES[now.month - 1]} de ${now.year}, ${now.time} (horário de Brasília)`
}

/**
 * Verifica se uma data é feriado consultando a tabela business_holidays.
 *
 * Para feriados com recurring=true (fixos como Natal), compara apenas mês+dia.
 * Para recurring=false (móveis como Carnaval), compara data exata.
 */
export async function checkHoliday(
  supabase: any,
  dateStr?: string
): Promise<HolidayCheck> {
  const now = getNowBrazil()
  const targetDate = dateStr || now.date
  const monthDay = targetDate.substring(5) // "MM-DD"

  try {
    // Busca feriados ativos: data exata OU recorrente com mesmo mês/dia
    const { data } = await supabase
      .from('business_holidays')
      .select('name, date, recurring')
      .eq('is_active', true)
      .or(`date.eq.${targetDate},and(recurring.eq.true,date.like.%-${monthDay})`)
      .limit(1)

    if (data && data.length > 0) {
      return { isHoliday: true, name: data[0].name }
    }
  } catch (e) {
    console.warn('[brazil-timezone] checkHoliday query error:', e)
  }

  return { isHoliday: false }
}

/**
 * Verifica se o momento atual está dentro do horário comercial.
 *
 * Checks (em ordem):
 * 1. Feriado → fechado
 * 2. Consulta tabela business_hours (por board ou global) → aplica horário real
 * 3. Fallback para texto supportHours → parseia horário
 * 4. Fallback padrão → seg-sex 08:00-18:00
 *
 * @param supabase - Cliente Supabase para consultar feriados e horários
 * @param supportHours - Texto de horário fallback (ex: "Segunda a Sexta, 08:00 às 18:00")
 * @param boardId - ID do kanban board para buscar horário específico
 */
export async function isBusinessHours(
  supabase: any,
  supportHours?: string,
  boardId?: string
): Promise<BusinessHoursStatus> {
  const now = getNowBrazil()

  // 1. Verificar feriado
  const holiday = await checkHoliday(supabase)
  if (holiday.isHoliday) {
    return { isOpen: false, reason: `Feriado: ${holiday.name}` }
  }

  // 2. Tentar buscar horário da tabela business_hours
  let startMinutes = -1
  let endMinutes = -1
  let dayAllowed = false
  let sourceLabel = 'padrão'

  try {
    // Buscar horário do board específico, ou global (board_id IS NULL)
    let query = supabase
      .from('business_hours')
      .select('day_of_week, start_time, end_time, is_active')
      .eq('day_of_week', now.dayOfWeek)
      .eq('is_active', true)

    if (boardId) {
      query = query.eq('board_id', boardId)
    } else {
      query = query.is('board_id', null)
    }

    const { data: hoursData } = await query.maybeSingle()

    if (hoursData) {
      const [sh, sm] = (hoursData.start_time || '08:00').split(':').map(Number)
      const [eh, em] = (hoursData.end_time || '18:00').split(':').map(Number)
      startMinutes = sh * 60 + sm
      endMinutes = eh * 60 + em
      dayAllowed = true
      sourceLabel = boardId ? 'board' : 'global'
    } else if (boardId) {
      // Fallback: tentar horário global se o board não tem config
      const { data: globalHours } = await supabase
        .from('business_hours')
        .select('day_of_week, start_time, end_time, is_active')
        .eq('day_of_week', now.dayOfWeek)
        .eq('is_active', true)
        .is('board_id', null)
        .maybeSingle()

      if (globalHours) {
        const [sh, sm] = (globalHours.start_time || '08:00').split(':').map(Number)
        const [eh, em] = (globalHours.end_time || '18:00').split(':').map(Number)
        startMinutes = sh * 60 + sm
        endMinutes = eh * 60 + em
        dayAllowed = true
        sourceLabel = 'global (fallback)'
      }
    }
  } catch (e) {
    console.warn('[brazil-timezone] business_hours query error:', e)
  }

  // 3. Se não encontrou na tabela, usar texto supportHours ou padrão
  if (startMinutes === -1) {
    const parsed = parseBusinessHours(supportHours)
    startMinutes = parsed.startHour * 60 + parsed.startMin
    endMinutes = parsed.endHour * 60 + parsed.endMin
    dayAllowed = parsed.days.includes(now.dayOfWeek)
    sourceLabel = supportHours ? 'texto' : 'padrão'
  }

  // 4. Verificar se o dia está permitido
  if (!dayAllowed) {
    return { isOpen: false, reason: `Fora dos dias de atendimento (${now.dayName})` }
  }

  const currentMinutes = now.hour * 60 + now.minute

  if (currentMinutes < startMinutes) {
    const h = Math.floor(startMinutes / 60)
    const m = startMinutes % 60
    return {
      isOpen: false,
      reason: `Antes do horário comercial (abre às ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}) [${sourceLabel}]`,
    }
  }

  if (currentMinutes >= endMinutes) {
    const h = Math.floor(endMinutes / 60)
    const m = endMinutes % 60
    return {
      isOpen: false,
      reason: `Após o horário comercial (fechou às ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}) [${sourceLabel}]`,
    }
  }

  return { isOpen: true, reason: `Dentro do horário comercial [${sourceLabel}]` }
}

/**
 * Calcula o próximo dia útil (não feriado, não fim de semana).
 * Retorna string formatada: "segunda-feira, 20/03/2026"
 */
export async function getNextBusinessDay(supabase: any): Promise<string> {
  const now = getNowBrazil()
  const pad = (n: number) => String(n).padStart(2, '0')

  // Começa de amanhã
  const cursor = new Date(now.year, now.month - 1, now.day)

  for (let i = 0; i < 30; i++) {
    cursor.setDate(cursor.getDate() + 1)
    const dow = cursor.getDay()

    // Pular fins de semana
    if (dow === 0 || dow === 6) continue

    const dateStr = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`
    const holiday = await checkHoliday(supabase, dateStr)

    if (!holiday.isHoliday) {
      return `${DAY_NAMES[dow]}, ${pad(cursor.getDate())}/${pad(cursor.getMonth() + 1)}/${cursor.getFullYear()}`
    }
  }

  // Fallback (não deve acontecer — 30 dias consecutivos de feriado seria impossível)
  return 'próximo dia útil'
}

// ── Helpers internos ──

interface ParsedHours {
  days: number[]
  startHour: number
  startMin: number
  endHour: number
  endMin: number
}

const DAY_MAP: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1, 'segunda-feira': 1,
  terca: 2, ter: 2, 'terça': 2, 'terça-feira': 2, 'terca-feira': 2,
  quarta: 3, qua: 3, 'quarta-feira': 3,
  quinta: 4, qui: 4, 'quinta-feira': 4,
  sexta: 5, sex: 5, 'sexta-feira': 5,
  sabado: 6, sab: 6, 'sábado': 6,
}

/**
 * Parseia texto de horário comercial.
 * Ex: "Segunda a Sexta, 08:00 às 18:00" → { days: [1,2,3,4,5], startHour: 8, startMin: 0, endHour: 18, endMin: 0 }
 *
 * Fallback: seg-sex 08:00-18:00
 */
function parseBusinessHours(text?: string): ParsedHours {
  const DEFAULT: ParsedHours = { days: [1, 2, 3, 4, 5], startHour: 8, startMin: 0, endHour: 18, endMin: 0 }

  if (!text) return DEFAULT

  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos para matching
    .trim()

  try {
    // Extrair range de dias: "segunda a sexta", "seg a sex"
    const dayRangeMatch = normalized.match(
      /(segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)\s*(?:a|ate|até)\s*(segunda(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)/i
    )

    let days = DEFAULT.days
    if (dayRangeMatch) {
      const startDay = DAY_MAP[dayRangeMatch[1]] ?? 1
      const endDay = DAY_MAP[dayRangeMatch[2]] ?? 5
      days = []
      for (let d = startDay; d <= endDay; d++) {
        days.push(d)
      }
      // Se vazio (range invertido), usar default
      if (days.length === 0) days = DEFAULT.days
    }

    // Extrair horários: "08:00 às 18:00", "8h às 18h", "08:00 - 18:00"
    const timeMatch = normalized.match(
      /(\d{1,2})[h:](\d{0,2})\s*(?:as|às|ate|até|-|a)\s*(\d{1,2})[h:](\d{0,2})/
    )

    if (timeMatch) {
      return {
        days,
        startHour: parseInt(timeMatch[1]),
        startMin: parseInt(timeMatch[2] || '0'),
        endHour: parseInt(timeMatch[3]),
        endMin: parseInt(timeMatch[4] || '0'),
      }
    }

    // Se encontrou dias mas não horário, usar horários default
    if (dayRangeMatch) {
      return { ...DEFAULT, days }
    }
  } catch (e) {
    console.warn('[brazil-timezone] parseBusinessHours error:', e)
  }

  return DEFAULT
}

/**
 * Gera mensagem para clientes que entram em contato fora do expediente.
 * Inclui o motivo (feriado, fim de semana, fora do horário) e o próximo dia útil.
 */
export async function getAfterHoursMessage(
  supabase: any,
  businessStatus: BusinessHoursStatus
): Promise<string> {
  const nextDay = await getNextBusinessDay(supabase)
  const greeting = getGreetingByTime()

  if (businessStatus.reason.startsWith('Feriado:')) {
    const holidayName = businessStatus.reason.replace('Feriado: ', '')
    return `${greeting}! 😊 Hoje é feriado (${holidayName}) e nosso time está de folga. Mas fique tranquilo(a), sua mensagem foi registrada e será atendida no próximo dia útil (${nextDay}). Se for urgente, responda aqui que nossa IA vai tentar te ajudar!`
  }

  if (businessStatus.reason.includes('Fora dos dias de atendimento')) {
    return `${greeting}! 😊 Nosso atendimento humano não funciona hoje, mas sua mensagem foi registrada. Retornaremos no próximo dia útil (${nextDay}). Enquanto isso, posso tentar te ajudar — é só me contar o que precisa!`
  }

  // Antes ou depois do horário comercial
  return `${greeting}! 😊 Nosso atendimento humano está encerrado no momento. Sua mensagem foi registrada e será atendida no próximo horário comercial. Enquanto isso, posso tentar te ajudar — é só me contar o que precisa!`
}

/**
 * Retorna saudação baseada no horário de Brasília:
 * 06:00–11:59 → "Bom dia", 12:00–17:59 → "Boa tarde", 18:00–05:59 → "Boa noite"
 */
export function getGreetingByTime(): string {
  const now = getNowBrazil()
  const hour = now.hour
  if (hour >= 6 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}
