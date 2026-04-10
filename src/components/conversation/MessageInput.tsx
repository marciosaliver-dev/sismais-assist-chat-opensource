import { useState } from "react";
import { Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageInputProps {
  onSend: (content: string) => void;
  initialValue?: string;
}

export function MessageInput({ onSend, initialValue = "" }: MessageInputProps) {
  const [value, setValue] = useState(initialValue);

  // Update value when initialValue changes (for AI suggestions)
  useState(() => {
    if (initialValue) {
      setValue(initialValue);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSend(value);
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card">
      <div className="flex items-end gap-3">
        <Button type="button" variant="ghost" size="icon" className="shrink-0">
          <Paperclip className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Digite sua mensagem..."
            rows={1}
            className="w-full bg-background border border-input rounded-lg px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-smooth min-h-[42px] max-h-[120px]"
            style={{ height: "auto" }}
          />
        </div>
        <Button type="submit" size="icon" className="shrink-0">
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </form>
  );
}
