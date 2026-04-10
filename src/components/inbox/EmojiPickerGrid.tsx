import { EMOJI_LIST } from './chat-utils'

interface EmojiPickerGridProps {
  onSelect: (emoji: string) => void
}

export function EmojiPickerGrid({ onSelect }: EmojiPickerGridProps) {
  return (
    <div className="grid grid-cols-10 gap-1 p-2 max-h-[200px] overflow-y-auto">
      {EMOJI_LIST.map((emoji) => (
        <button key={emoji} onClick={() => onSelect(emoji)} className="w-8 h-8 flex items-center justify-center text-lg hover:bg-secondary rounded transition-colors">
          {emoji}
        </button>
      ))}
    </div>
  )
}
