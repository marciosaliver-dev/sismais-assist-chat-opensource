import { useQuery } from '@tanstack/react-query'

const FALLBACK_RATE = 5.5
const CACHE_KEY = 'usd_brl_rate'
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

interface CachedRate {
  rate: number
  timestamp: number
}

function getCachedRate(): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached: CachedRate = JSON.parse(raw)
    if (Date.now() - cached.timestamp < CACHE_TTL) return cached.rate
  } catch { /* ignore */ }
  return null
}

function setCachedRate(rate: number) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, timestamp: Date.now() } satisfies CachedRate))
  } catch { /* ignore */ }
}

async function fetchUsdBrlRate(): Promise<number> {
  const cached = getCachedRate()
  if (cached) return cached

  try {
    const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL')
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    const rate = parseFloat(data.USDBRL?.bid)
    if (isNaN(rate) || rate <= 0) throw new Error('Invalid rate')
    setCachedRate(rate)
    return rate
  } catch {
    // Try backup API
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD')
      if (!res.ok) throw new Error('Backup API error')
      const data = await res.json()
      const rate = data.rates?.BRL
      if (!rate || isNaN(rate)) throw new Error('Invalid rate')
      setCachedRate(rate)
      return rate
    } catch {
      return getCachedRate() || FALLBACK_RATE
    }
  }
}

export function useExchangeRate() {
  const { data: rate = FALLBACK_RATE, isLoading } = useQuery({
    queryKey: ['exchange-rate-usd-brl'],
    queryFn: fetchUsdBrlRate,
    staleTime: CACHE_TTL,
    gcTime: CACHE_TTL * 2,
    refetchOnWindowFocus: false,
    retry: 2,
  })

  return { rate, isLoading }
}
