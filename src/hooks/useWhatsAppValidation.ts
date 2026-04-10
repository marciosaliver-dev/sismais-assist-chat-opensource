import { useCallback, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface ValidationResult {
  valid: boolean
  jid?: string | null
  unknown?: boolean
}

export function useWhatsAppValidation() {
  const [validating, setValidating] = useState(false)

  const validateNumber = useCallback(async (
    phone: string,
    instanceId: string
  ): Promise<ValidationResult> => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length < 8) {
      return { valid: false }
    }

    setValidating(true)
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'checkOnWhatsApp',
          instanceId,
          phone: cleanPhone,
        },
      })

      if (error) {
        console.warn('WhatsApp validation error:', error)
        // Don't block on error — assume valid
        return { valid: true, unknown: true }
      }

      if (data?.data?.unknown) {
        return { valid: true, unknown: true }
      }

      return {
        valid: data?.data?.exists !== false,
        jid: data?.data?.jid || null,
      }
    } catch (err) {
      console.warn('WhatsApp validation failed:', err)
      return { valid: true, unknown: true }
    } finally {
      setValidating(false)
    }
  }, [])

  return { validateNumber, validating }
}
