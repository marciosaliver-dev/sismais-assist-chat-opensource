/**
 * MediaContent — Renderizador de mensagens de mídia (áudio, imagem, vídeo, documento).
 *
 * Extraído de ChatArea.tsx na Onda 5A da refatoração do módulo de IA.
 * A extração é PURAMENTE MECÂNICA — zero mudança de comportamento em relação
 * à versão anterior inline em ChatArea. Se bugar, o diff vs. ChatArea@pré-5A
 * deve ser idêntico ao código aqui.
 *
 * Responsabilidades:
 * - Imagem/sticker com auto-retry, lightbox, thumbnail-to-full fallback
 * - Vídeo com auto-retry em URLs expiradas
 * - Áudio/PTT com waveform custom, controle de velocidade, transcrição
 * - Documento como link clicável
 * - Fallback: texto com linkify + HTML sanitizado + detecção de URL para LinkPreview
 *
 * NÃO MEXER na integração com uazapi-proxy, media-worker, transcribe-media —
 * foi validado em produção e é parte do critical path de atendimento.
 */

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Loader2, Image as ImageIcon, Video, FileText, Download, Pause, Play,
  MicOff, RefreshCw, ZoomIn,
} from 'lucide-react'
import { format } from 'date-fns'
import DOMPurify from 'dompurify'
import { cn } from '@/lib/utils'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { LinkPreview, extractFirstUrl } from './LinkPreview'
import { DeliveryStatus } from './DeliveryStatus'
import { TranscriptionBlock } from './TranscriptionBlock'
import {
  isEncryptedUrl, linkifyText, isEmojiOnly, getEmojiSize,
  AUDIO_SPEED_OPTIONS, generateWaveform,
} from './chat-utils'

interface MediaContentProps {
  mediaUrl?: string | null
  mediaType?: string | null
  content: string
  onOpenLightbox?: (url: string) => void
  messageId?: string
  uazapiMessageId?: string | null
  conversationId?: string
  createdAt?: string | null
  whatsappInstanceId?: string | null
  isMediaBubble?: boolean
  deliveryStatus?: string | null
  isOutbound?: boolean
}

export function MediaContent({
  mediaUrl,
  mediaType,
  content,
  onOpenLightbox,
  messageId,
  uazapiMessageId,
  conversationId,
  createdAt,
  whatsappInstanceId,
  isMediaBubble,
  deliveryStatus,
  isOutbound,
}: MediaContentProps) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioRequested, setAudioRequested] = useState(false)
  const [retryingMedia, setRetryingMedia] = useState(false)
  const [retranscribing, setRetranscribing] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [audioSpeed, setAudioSpeed] = useState(1)
  const [autoRefreshAttempted, setAutoRefreshAttempted] = useState(false)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3

  // Timeout: se imagem não carregar em 30s, mostrar estado de erro com botões de retry
  useEffect(() => {
    if (mediaType !== 'image' && mediaType !== 'sticker') return
    if (imgLoaded || imgError) return
    const timer = setTimeout(() => {
      if (!imgLoaded && !imgError) {
        setImgError(true)
      }
    }, 30000)
    return () => clearTimeout(timer)
  }, [mediaType, imgLoaded, imgError, resolvedUrl])

  // Reset image loading states when resolvedUrl changes (e.g. after retry download)
  useEffect(() => {
    if (resolvedUrl) {
      setImgError(false)
      setImgLoaded(false)
      setAutoRefreshAttempted(false)
      retryCountRef.current = 0
    }
  }, [resolvedUrl])

  // Detects if URL is a thumbnail fallback from webhook
  const isThumbnailUrl = (url?: string | null): boolean => {
    if (!url) return false
    return url.includes('/thumbnails/')
  }
  const [isThumbnail, setIsThumbnail] = useState(() => isThumbnailUrl(mediaUrl))
  const [loadingFullImage, setLoadingFullImage] = useState(false)
  useEffect(() => {
    setIsThumbnail(isThumbnailUrl(mediaUrl))
  }, [mediaUrl])

  const [thumbnailAutoFailed, setThumbnailAutoFailed] = useState(false)

  // Auto-download full image when thumbnail is detected on mount
  useEffect(() => {
    if (isThumbnailUrl(mediaUrl) && uazapiMessageId && whatsappInstanceId) {
      handleLoadFullImage(true).then(() => {
        // Check if still thumbnail after attempt — means it failed
        // We use a small delay to let state settle
        setTimeout(() => {
          if (isThumbnailUrl(mediaUrl) && !resolvedUrl) {
            setThumbnailAutoFailed(true)
          }
        }, 1000)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const audioElRef = useRef<HTMLAudioElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const [waveform] = useState(() => generateWaveform(mediaUrl || content || 'audio', 40))

  const formatDuration = (seconds: number, placeholder = '0:00') => {
    if (!seconds || !isFinite(seconds)) return placeholder
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleAudioPlayPause = () => {
    if (!audioRequested) {
      setAudioRequested(true)
      return
    }
    const audio = audioElRef.current
    if (!audio) return
    if (audioPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    setAudioPlaying(!audioPlaying)
  }

  // Auto-play quando o elemento <audio> monta pela primeira vez após clique
  useEffect(() => {
    if (!audioRequested) return
    const audio = audioElRef.current
    if (!audio) return
    audio.play().catch(() => {
      // Autoplay bloqueado pelo browser — usuário precisará clicar novamente
    })
    setAudioPlaying(true)
  }, [audioRequested])

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioElRef.current
    const container = waveformRef.current
    if (!audio || !container || !audio.duration) return
    const rect = container.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    audio.currentTime = pct * audio.duration
    setAudioProgress(pct * 100)
    setAudioCurrentTime(audio.currentTime)
  }

  const handleRetranscribe = async () => {
    if (!messageId || retranscribing) return
    setRetranscribing(true)
    try {
      // If mediaUrl is not available locally, try to fetch it from the database
      let effectiveMediaUrl = mediaUrl
      if (!effectiveMediaUrl) {
        const { data: msgData } = await supabase
          .from('ai_messages')
          .select('media_url')
          .eq('id', messageId)
          .single()
        effectiveMediaUrl = (msgData as any)?.media_url || ''
      }
      if (!effectiveMediaUrl) {
        toast.error('URL da mídia não disponível para re-transcrição')
        return
      }
      const { error } = await supabase.functions.invoke('transcribe-media', {
        body: {
          message_id: messageId,
          conversation_id: conversationId,
          media_url: effectiveMediaUrl,
          media_type: mediaType,
        },
      })
      if (error) throw error
      toast.success('Transcrição solicitada! Aguarde alguns segundos...')
    } catch (e: unknown) {
      toast.error('Erro ao re-transcrever: ' + ((e as Error).message || 'falha'))
    } finally {
      setRetranscribing(false)
    }
  }

  const handleRetryDownload = async () => {
    if (!uazapiMessageId || retryingMedia) return
    setRetryingMedia(true)
    try {
      // Use conversation's whatsapp_instance_id first, then fallback to any active instance
      let instanceId = whatsappInstanceId
      if (!instanceId) {
        const { data: instData } = await (supabase as any).from('uazapi_instances_public').select('id').eq('is_active', true).limit(1).single()
        if (!instData) throw new Error('Nenhuma instância ativa')
        instanceId = instData.id
      }
      // Fetch mimetype from uazapi_messages for better download context
      let mediaMimetype: string | undefined;
      if (uazapiMessageId) {
        const { data: uzMsg } = await supabase
          .from('uazapi_messages')
          .select('media_mimetype, type')
          .eq('message_id', uazapiMessageId)
          .maybeSingle()
        mediaMimetype = (uzMsg as any)?.media_mimetype || undefined
      }
      const { data, error } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'downloadMedia',
          instanceId,
          messageId: uazapiMessageId,
          mediaUrl: mediaUrl,
          mediaMimetype,
          mediaType,
        },
      })
      if (error || !data?.data?.mediaUrl) {
        console.warn('[retryMedia] Download failed (media likely expired):', error?.message || 'no URL returned')
        toast.error('Mídia expirada ou indisponível no WhatsApp.')
        return
      }
      const newUrl = data.data.mediaUrl
      // Update ai_messages with new URL
      if (messageId) {
        await supabase.from('ai_messages').update({ media_url: newUrl }).eq('id', messageId)
      }
      setResolvedUrl(newUrl)
      setImgError(false)
      setVideoError(false)
      toast.success('Mídia baixada com sucesso!')
    } catch (e: unknown) {
      toast.error('Erro: ' + ((e as Error).message || 'falha no download'))
    } finally {
      setRetryingMedia(false)
    }
  }

  // Auto-refresh expired signed URLs from Supabase Storage
  const [refreshingSignedUrl, setRefreshingSignedUrl] = useState(false)
  const handleRefreshSignedUrl = async () => {
    if (!effectiveUrlRef || refreshingSignedUrl) return
    setRefreshingSignedUrl(true)
    try {
      // Extract path from signed URL: .../object/sign/whatsapp-media/PATH?token=...
      const signMatch = effectiveUrlRef.match(/\/object\/sign\/whatsapp-media\/([^?]+)/)
      // Also handle public URLs: .../object/public/whatsapp-media/PATH
      const publicMatch = effectiveUrlRef.match(/\/object\/public\/whatsapp-media\/([^?]+)/)
      const path = signMatch?.[1] || publicMatch?.[1]
      if (!path) {
        toast.error('Não foi possível extrair o caminho da mídia')
        return
      }
      const decodedPath = decodeURIComponent(path)
      const { data, error } = await supabase.storage.from('whatsapp-media').createSignedUrl(decodedPath, 31536000)
      if (error || !data?.signedUrl) {
        toast.error('Erro ao renovar URL: ' + (error?.message || 'falha'))
        return
      }
      setResolvedUrl(data.signedUrl)
      setImgError(false)
      setVideoError(false)
      // Persist new URL
      if (messageId) {
        await supabase.from('ai_messages').update({ media_url: data.signedUrl }).eq('id', messageId)
      }
    } catch (e: unknown) {
      toast.error('Erro: ' + ((e as Error).message || 'falha'))
    } finally {
      setRefreshingSignedUrl(false)
    }
  }

  const handleLoadFullImage = async (silent = false) => {
    if (!uazapiMessageId || !whatsappInstanceId) return
    setLoadingFullImage(true)
    try {
      const { data: proxyResult, error: proxyError } = await supabase.functions.invoke('uazapi-proxy', {
        body: {
          action: 'downloadMedia',
          instanceId: whatsappInstanceId,
          messageId: uazapiMessageId,
        }
      })
      const newUrl = proxyResult?.data?.mediaUrl
      if (proxyError || !newUrl) {
        if (!silent) {
          console.error('[loadFullImage] Failed:', proxyError)
          toast.error('Mídia expirada ou indisponível.')
        }
        return
      }
      setResolvedUrl(newUrl)
      // Persist new URL to avoid re-downloading on next visit
      if (messageId) {
        supabase.from('ai_messages').update({ media_url: newUrl }).eq('id', messageId).then(() => {})
      }
      setIsThumbnail(false)
    } catch (e) {
      if (!silent) {
        console.error('[loadFullImage] Error:', e)
        toast.error('Mídia expirada ou indisponível.')
      }
    } finally {
      setLoadingFullImage(false)
    }
  }

  const effectiveUrl = resolvedUrl || mediaUrl
  const effectiveUrlRef = effectiveUrl // keep ref for closure

  // Skeleton state: media_url not yet available but media_type is set (download in progress)
  if (!effectiveUrl && mediaType) {
    return (
      <div className="flex flex-col items-center gap-2 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
        <div className="w-[200px] h-[150px] bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
        <span className="text-xs text-gray-500">Baixando mídia...</span>
      </div>
    );
  }

  if (!effectiveUrl) return <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(content)}</p>

  const encrypted = isEncryptedUrl(effectiveUrl) && !resolvedUrl
  const isSupabaseStorageUrl = effectiveUrl.includes('whatsapp-media') && (effectiveUrl.includes('/object/sign/') || effectiveUrl.includes('/object/public/'))

      switch (mediaType) {
    case 'image':
    case 'sticker':
      return (
        <>
          {imgError || encrypted ? (
            <div className="flex flex-col gap-2 p-3 bg-background/50 rounded-lg">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{encrypted ? 'Imagem indisponível — mídia criptografada' : 'Imagem não carregou'}</span>
              </div>
              {/* Auto-refresh failed or encrypted — show manual buttons */}
              {isSupabaseStorageUrl && (
                <Button size="sm" variant="outline" className="w-fit text-xs" onClick={handleRefreshSignedUrl} disabled={refreshingSignedUrl}>
                  {refreshingSignedUrl ? '⏳ Renovando...' : '🔄 Renovar URL'}
                </Button>
              )}
              {uazapiMessageId && (
                <Button size="sm" variant="outline" className="w-fit text-xs" onClick={handleRetryDownload} disabled={retryingMedia}>
                  {retryingMedia ? '⏳ Baixando...' : '📥 Baixar novamente da origem'}
                </Button>
              )}
              <Button size="sm" variant="outline" className="w-fit text-xs" onClick={async () => {
                try {
                  setRetryingMedia(true);
                  await supabase.functions.invoke("media-worker", { body: {} });
                  toast.info("Processando mídia em fila...");
                } catch {
                  toast.error("Erro ao reprocessar mídia");
                } finally {
                  setRetryingMedia(false);
                }
              }} disabled={retryingMedia}>
                {retryingMedia ? '⏳ Processando...' : '🔄 Reprocessar fila de mídia'}
              </Button>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "relative group/img cursor-pointer",
                  // When inside media bubble, parent handles overflow-hidden+rounding; here we just need relative positioning
                  // When standalone, keep our own rounded overflow container
                  isMediaBubble ? "overflow-hidden" : "overflow-hidden rounded-lg"
                )}
                onClick={() => !isThumbnail ? onOpenLightbox?.(effectiveUrl!) : undefined}
              >
                {!imgLoaded && (
                  <div className={cn(
                    "bg-gradient-to-br from-primary/10 to-muted animate-pulse",
                    isMediaBubble ? "" : "rounded-lg",
                    mediaType === 'sticker' ? 'max-w-[150px] h-[150px]' : 'max-w-[220px] w-full h-[130px]'
                  )}>
                    {loadingFullImage && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                      </div>
                    )}
                  </div>
                )}
                <img
                  src={effectiveUrl!}
                  alt="Imagem"
                  className={cn(
                    'hover:opacity-90 transition-all duration-300',
                    isMediaBubble ? 'w-full block max-h-[220px] object-cover' : 'rounded-lg max-w-[220px] w-full',
                    mediaType === 'sticker' ? 'max-w-[150px] bg-transparent' : '',
                    imgLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm absolute inset-0 w-full'
                  )}
                  onError={async () => {
                    retryCountRef.current += 1
                    const currentRetry = retryCountRef.current

                    // Exhaust all retries before showing error UI
                    if (currentRetry > MAX_RETRIES) {
                      setImgError(true)
                      return
                    }

                    // Retry 1: Try refreshing signed URL (Supabase Storage)
                    if (currentRetry === 1 && isSupabaseStorageUrl) {
                      try {
                        const signMatch = effectiveUrl?.match(/\/object\/sign\/whatsapp-media\/([^?]+)/)
                        const publicMatch = effectiveUrl?.match(/\/object\/public\/whatsapp-media\/([^?]+)/)
                        const path = signMatch?.[1] || publicMatch?.[1]
                        if (path) {
                          const decodedPath = decodeURIComponent(path)
                          const { data: refreshData } = await supabase.storage.from('whatsapp-media').createSignedUrl(decodedPath, 31536000)
                          if (refreshData?.signedUrl) {
                            setResolvedUrl(refreshData.signedUrl)
                            if (messageId) {
                              supabase.from('ai_messages').update({ media_url: refreshData.signedUrl }).eq('id', messageId).then(() => {})
                            }
                            return
                          }
                        }
                      } catch { /* fall through to next retry */ }
                    }

                    // Retry 2: Try re-downloading from UAZAPI origin
                    if (currentRetry <= 2 && uazapiMessageId && whatsappInstanceId) {
                      try {
                        const { data: proxyResult } = await supabase.functions.invoke('uazapi-proxy', {
                          body: { action: 'downloadMedia', instanceId: whatsappInstanceId, messageId: uazapiMessageId, mediaType, mediaUrl }
                        })
                        const newUrl = proxyResult?.data?.mediaUrl
                        if (newUrl) {
                          setResolvedUrl(newUrl)
                          if (messageId) {
                            supabase.from('ai_messages').update({ media_url: newUrl }).eq('id', messageId).then(() => {})
                          }
                          return
                        }
                      } catch { /* fall through to next retry */ }
                    }

                    // Retry 3: One more attempt with signed URL refresh as last resort
                    if (currentRetry === 3 && isSupabaseStorageUrl) {
                      try {
                        const signMatch = effectiveUrl?.match(/\/object\/sign\/whatsapp-media\/([^?]+)/)
                        const publicMatch = effectiveUrl?.match(/\/object\/public\/whatsapp-media\/([^?]+)/)
                        const path = signMatch?.[1] || publicMatch?.[1]
                        if (path) {
                          const decodedPath = decodeURIComponent(path)
                          const { data: refreshData } = await supabase.storage.from('whatsapp-media').createSignedUrl(decodedPath, 31536000)
                          if (refreshData?.signedUrl) {
                            setResolvedUrl(refreshData.signedUrl)
                            if (messageId) {
                              supabase.from('ai_messages').update({ media_url: refreshData.signedUrl }).eq('id', messageId).then(() => {})
                            }
                            return
                          }
                        }
                      } catch { /* fall through to error */ }
                    }

                    // All retries for this attempt exhausted — show error
                    setImgError(true)
                  }}
                  onLoad={() => setImgLoaded(true)}
                  loading="lazy"
                />
                {/* Hover overlay with zoom icon */}
                <div className={cn(
                  "absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors flex items-center justify-center",
                  isMediaBubble ? "" : "rounded-lg"
                )}>
                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover/img:opacity-90 transition-opacity drop-shadow-lg" />
                </div>
                {/* WhatsApp-style timestamp overlay at bottom-right of image */}
                {isMediaBubble && createdAt && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 z-10">
                    <span className="text-xs text-white font-medium leading-none">
                      {format(new Date(createdAt), 'HH:mm')}
                    </span>
                    {deliveryStatus && isOutbound && (
                      <span className="text-white/90 scale-75 origin-right"><DeliveryStatus status={deliveryStatus} /></span>
                    )}
                  </div>
                )}
                {/* Loading spinner overlay for thumbnail auto-download */}
                {isThumbnail && loadingFullImage && imgLoaded && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              {/* Manual fallback button if auto-download failed or thumbnail still visible */}
              {isThumbnail && !loadingFullImage && (
                <button
                  onClick={() => { setThumbnailAutoFailed(false); handleLoadFullImage(false) }}
                  disabled={loadingFullImage}
                  className={cn(
                    "flex items-center gap-1.5 text-xs hover:underline disabled:opacity-50 disabled:cursor-not-allowed",
                    thumbnailAutoFailed ? "text-amber-600 dark:text-amber-400" : "text-primary",
                    isMediaBubble ? "px-3 py-1.5" : "mt-1"
                  )}
                >
                  <span>{thumbnailAutoFailed ? '⚠️' : '🔍'}</span>
                  <span>{thumbnailAutoFailed ? 'Imagem em baixa resolução — clique para tentar novamente' : 'Ver imagem completa'}</span>
                </button>
              )}
              {/* Caption strip for media bubble */}
              {isMediaBubble && content && !content.startsWith('[') && (
                <p className="px-3 py-1.5 text-sm whitespace-pre-wrap break-words">{linkifyText(content)}</p>
              )}
            </>
          )}
          {!isMediaBubble && content && !content.startsWith('[') && (
<p className="text-sm whitespace-pre-wrap break-words mt-1.5">{linkifyText(content)}</p>
          )}
        </>
      )

    case 'video':
      return (
        <>
          {encrypted || videoError ? (
            <div className="flex flex-col gap-2 p-3 bg-background/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {encrypted ? 'Vídeo indisponível — mídia criptografada' : 'Vídeo não carregou'}
                </span>
              </div>
              {isSupabaseStorageUrl && (
                <Button size="sm" variant="outline" className="w-fit text-xs" onClick={handleRefreshSignedUrl} disabled={refreshingSignedUrl}>
                  {refreshingSignedUrl ? '⏳ Renovando...' : '🔄 Renovar URL'}
                </Button>
              )}
              {uazapiMessageId && (
                <Button size="sm" variant="outline" className="w-fit text-xs" onClick={handleRetryDownload} disabled={retryingMedia}>
                  {retryingMedia ? '⏳ Baixando...' : '📥 Baixar novamente da origem'}
                </Button>
              )}
              <Button size="sm" variant="outline" className="w-fit text-xs" onClick={async () => {
                try {
                  setRetryingMedia(true);
                  await supabase.functions.invoke("media-worker", { body: {} });
                  toast.info("Processando mídia em fila...");
                } catch {
                  toast.error("Erro ao reprocessar mídia");
                } finally {
                  setRetryingMedia(false);
                }
              }} disabled={retryingMedia}>
                {retryingMedia ? '⏳ Processando...' : '🔄 Reprocessar fila de mídia'}
              </Button>
            </div>
          ) : (
            <div className="relative max-w-[220px] w-full rounded-lg overflow-hidden">
              {!videoLoaded && (
                <div className="w-full h-[220px] bg-gradient-to-br from-primary/10 to-muted animate-pulse rounded-lg flex items-center justify-center">
                  <Video className="w-10 h-10 text-muted-foreground/40" />
                </div>
              )}
              <video
                src={effectiveUrl!}
                controls
                className={cn('w-full rounded-lg', videoLoaded ? 'block' : 'hidden')}
                preload="metadata"
                onError={async () => {
                  if (!autoRefreshAttempted) {
                    setAutoRefreshAttempted(true)
                    if (isSupabaseStorageUrl) {
                      try {
                        const signMatch = effectiveUrl?.match(/\/object\/sign\/whatsapp-media\/([^?]+)/)
                        const publicMatch = effectiveUrl?.match(/\/object\/public\/whatsapp-media\/([^?]+)/)
                        const path = signMatch?.[1] || publicMatch?.[1]
                        if (path) {
                          const decodedPath = decodeURIComponent(path)
                          const { data: refreshData } = await supabase.storage.from('whatsapp-media').createSignedUrl(decodedPath, 31536000)
                          if (refreshData?.signedUrl) {
                            setResolvedUrl(refreshData.signedUrl)
                            if (messageId) {
                              supabase.from('ai_messages').update({ media_url: refreshData.signedUrl }).eq('id', messageId).then(() => {})
                            }
                            return
                          }
                        }
                      } catch { /* fall through to retry download */ }
                    }
                    if (uazapiMessageId && whatsappInstanceId) {
                      try {
                        const { data: proxyResult } = await supabase.functions.invoke('uazapi-proxy', {
                          body: { action: 'downloadMedia', instanceId: whatsappInstanceId, messageId: uazapiMessageId }
                        })
                        const newUrl = proxyResult?.data?.mediaUrl
                        if (newUrl) {
                          setResolvedUrl(newUrl)
                          if (messageId) {
                            supabase.from('ai_messages').update({ media_url: newUrl }).eq('id', messageId).then(() => {})
                          }
                          return
                        }
                      } catch { /* fall through */ }
                    }
                  }
                  setVideoError(true)
                }}
                onLoadedData={() => setVideoLoaded(true)}
              />
            </div>
          )}
          {content && !content.startsWith('[') && (
<p className="text-sm whitespace-pre-wrap break-words mt-1.5">{linkifyText(content)}</p>
           )}
        </>
      )

    case 'audio':
    case 'ptt': {
      // Derive transcription state from content (content acts as state machine)
      // Explicit failure markers set by transcribe-media edge function on error
      const isExplicitFailed = content === '[Áudio - transcrição falhou]' || content === '[Imagem - processamento falhou]'
      const isTranscribing = !isExplicitFailed && (
        !content ||
        content === '[ptt]' ||
        content === '[audio]' ||
        content === '[Áudio]' ||
        /^\[Áudio de \d+:\d+\]$/.test(content) ||
        /^\[audio\]$/i.test(content)
      )
      // Heuristic: if >2 min old and still placeholder → transcription likely failed
      const isLikelyFailed = isExplicitFailed || (isTranscribing && createdAt
        ? (Date.now() - new Date(createdAt).getTime()) > 2 * 60 * 1000
        : false)
      const transcriptionText = content?.startsWith('[Áudio transcrito] ')
        ? content.replace('[Áudio transcrito] ', '')
        : null

      if (encrypted) {
        return (
          <div className="flex flex-col gap-2 min-w-0 w-full py-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <MicOff className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Áudio indisponível — mídia criptografada</span>
            </div>
            {uazapiMessageId && (
              <Button size="sm" variant="outline" className="w-fit text-xs" onClick={handleRetryDownload} disabled={retryingMedia}>
                {retryingMedia ? '⏳ Baixando...' : '🔄 Tentar baixar'}
              </Button>
            )}
          </div>
        )
      }
      return (
        <div className="flex items-center gap-3 min-w-0 w-full py-1">
          <button
            onClick={handleAudioPlayPause}
            className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center shrink-0 transition-colors"
          >
            {audioPlaying ? (
              <Pause className="w-5 h-5 text-primary" />
            ) : (
              <Play className="w-5 h-5 text-primary ml-0.5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            {/* Waveform */}
            <div
              ref={waveformRef}
              onClick={handleProgressClick}
              className="flex items-end gap-[2px] h-[28px] cursor-pointer py-1"
            >
              {(() => {
                const playedBars = Math.floor((audioProgress / 100) * waveform.length)
                return waveform.map((h, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 rounded-full min-w-[2px] max-w-[4px] transition-colors duration-150",
                      i < playedBars ? "bg-primary" : "bg-muted-foreground/25"
                    )}
                    style={{ height: `${h * 100}%` }}
                  />
                ))
              })()}
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">{formatDuration(audioCurrentTime)}</span>
              <button
                onClick={() => {
                  const idx = AUDIO_SPEED_OPTIONS.indexOf(audioSpeed)
                  const next = AUDIO_SPEED_OPTIONS[(idx + 1) % AUDIO_SPEED_OPTIONS.length]
                  setAudioSpeed(next)
                  if (audioElRef.current) audioElRef.current.playbackRate = next
                }}
                className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              >
                {audioSpeed}×
              </button>
              <span className="text-xs text-muted-foreground">{audioRequested ? formatDuration(audioDuration, '--:--') : '--:--'}</span>
            </div>
            {/* Transcription status — shown below the speed/time row */}
            {isTranscribing ? (
              isLikelyFailed ? (
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-xs text-muted-foreground italic">Transcrição falhou</span>
                  {messageId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetranscribe}
                      disabled={retranscribing}
                      className="h-7 text-xs gap-1.5 mt-1"
                    >
                      {retranscribing
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Re-transcrevendo...</>
                        : <><RefreshCw className="w-3 h-3" /> Re-transcrever</>
                      }
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 mt-1 px-1">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground italic">Transcrevendo áudio...</span>
                </div>
              )
            ) : transcriptionText ? (
              <TranscriptionBlock text={transcriptionText} />
            ) : null}
          </div>
          {audioRequested && (
          <audio
            ref={audioElRef}
            src={effectiveUrl!}
            preload="auto"
            onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => {
              const audio = e.currentTarget
              setAudioCurrentTime(audio.currentTime)
              setAudioProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
            }}
            onEnded={() => { setAudioPlaying(false); setAudioProgress(0); setAudioCurrentTime(0) }}
            onError={async () => {
              if (!autoRefreshAttempted) {
                setAutoRefreshAttempted(true)
                if (isSupabaseStorageUrl) {
                  try {
                    const signMatch = effectiveUrl?.match(/\/object\/sign\/whatsapp-media\/([^?]+)/)
                    const publicMatch = effectiveUrl?.match(/\/object\/public\/whatsapp-media\/([^?]+)/)
                    const path = signMatch?.[1] || publicMatch?.[1]
                    if (path) {
                      const decodedPath = decodeURIComponent(path)
                      const { data: refreshData } = await supabase.storage.from('whatsapp-media').createSignedUrl(decodedPath, 31536000)
                      if (refreshData?.signedUrl) {
                        setResolvedUrl(refreshData.signedUrl)
                        if (messageId) {
                          supabase.from('ai_messages').update({ media_url: refreshData.signedUrl }).eq('id', messageId).then(() => {})
                        }
                        return
                      }
                    }
                  } catch { /* fall through to retry download */ }
                }
                if (uazapiMessageId && whatsappInstanceId) {
                  try {
                    const { data: proxyResult } = await supabase.functions.invoke('uazapi-proxy', {
                      body: { action: 'downloadMedia', instanceId: whatsappInstanceId, messageId: uazapiMessageId }
                    })
                    const newUrl = proxyResult?.data?.mediaUrl
                    if (newUrl) {
                      setResolvedUrl(newUrl)
                      if (messageId) {
                        supabase.from('ai_messages').update({ media_url: newUrl }).eq('id', messageId).then(() => {})
                      }
                      return
                    }
                  } catch { /* fall through */ }
                }
              }
            }}
            className="hidden"
          />
          )}
        </div>
      )
    }

    case 'document':
      return (
        <a
          href={effectiveUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-background/50 rounded-lg hover:bg-background transition-colors min-w-[220px]"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{content.replace('[Documento: ', '').replace(']', '') || 'Documento'}</p>
            <p className="text-xs text-muted-foreground">Clique para abrir</p>
          </div>
          <Download className="w-4 h-4 text-muted-foreground shrink-0" />
        </a>
      )

    default: {
      if (isEmojiOnly(content)) {
        return <p className={cn("whitespace-pre-wrap break-words leading-relaxed", getEmojiSize(content))}>{content}</p>
      }
      // Detectar e renderizar conteúdo HTML (ex: notas de cobrança)
      const hasHtml = /<[a-z][\s\S]*>/i.test(content)
      if (hasHtml) {
        const sanitized = DOMPurify.sanitize(content, {
          ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'b', 'strong', 'i', 'em', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4'],
          ALLOWED_ATTR: ['style', 'class', 'href', 'target']
        })
        return (
          <div
            className="text-sm break-words [&_table]:w-full [&_table]:border-collapse [&_td]:p-1.5 [&_td]:border [&_td]:border-border [&_td]:text-xs [&_th]:p-1.5 [&_th]:border [&_th]:border-border [&_th]:text-xs [&_th]:font-semibold [&_strong]:font-semibold"
            dangerouslySetInnerHTML={{ __html: sanitized }}
          />
        )
      }
      const detectedUrl = extractFirstUrl(content);
      return (
        <>
          <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(content)}</p>
          {detectedUrl && <LinkPreview url={detectedUrl} />}
        </>
      );
    }
  }
}
