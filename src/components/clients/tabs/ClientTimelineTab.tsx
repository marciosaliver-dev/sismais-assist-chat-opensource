import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Filter, MessageSquare } from 'lucide-react'
import { TimelineItem } from '@/components/clients/TimelineItem'
import { EVENT_TYPE_CHIPS, CHANNEL_CHIPS } from '../constants'

interface ClientTimelineTabProps {
  timelineEvents: any[]
  timelineLoading: boolean
}

export function ClientTimelineTab({ timelineEvents, timelineLoading }: ClientTimelineTabProps) {
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>([])

  function toggle(arr: string[], setter: (v: string[]) => void, value: string) {
    setter(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value])
  }

  // Filter events locally
  const filtered = timelineEvents.filter(e => {
    if (eventTypes.length > 0 && !eventTypes.includes(e.event_type)) return false
    if (channels.length > 0 && !channels.includes(e.channel)) return false
    return true
  })

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Filter chips */}
      <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Tipo:</span>
          {EVENT_TYPE_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => toggle(eventTypes, setEventTypes, chip.value)}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                eventTypes.includes(chip.value)
                  ? 'bg-[#10293F] text-white border-[#10293F]'
                  : 'bg-muted text-muted-foreground border-border hover:border-[#45E5E5]'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Canal:</span>
          {CHANNEL_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => toggle(channels, setChannels, chip.value)}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                channels.includes(chip.value)
                  ? 'bg-[#45E5E5] text-[#10293F] border-[#45E5E5]'
                  : 'bg-muted text-muted-foreground border-border hover:border-[#45E5E5]'
              }`}
            >
              {chip.label}
            </button>
          ))}
          {(eventTypes.length > 0 || channels.length > 0) && (
            <button
              onClick={() => { setEventTypes([]); setChannels([]) }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Timeline list */}
      <div className="flex-1 overflow-y-auto p-4">
        {timelineLoading ? (
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="w-48 h-4" />
                  <Skeleton className="w-72 h-3" />
                  <Skeleton className="w-24 h-3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum evento na timeline{(eventTypes.length > 0 || channels.length > 0) ? ' com estes filtros' : ''}.
          </p>
        ) : (
          <div>
            {filtered.map((event: any) => (
              <TimelineItem key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
