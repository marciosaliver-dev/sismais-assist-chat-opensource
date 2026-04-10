import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/ticket";
import { ResponseFeedback } from "./ResponseFeedback";

interface MessageListProps {
  messages: Message[];
  conversationId?: string;
  canCorrectResponses?: boolean;
}

export function MessageList({ messages, conversationId, canCorrectResponses = false }: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin bg-background/50">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex group",
            message.sender === "agent" ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "max-w-[70%] px-4 py-2.5 animate-fade-in",
              message.sender === "agent"
                ? "message-outgoing"
                : "message-incoming shadow-sm"
            )}
          >
            {message.sender === "agent" && message.senderName && (
              <p className="text-xs font-medium text-primary mb-1">
                {message.senderName}
              </p>
            )}
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {message.content}
            </p>
            <div className="flex items-center justify-end gap-1 mt-1">
              {message.sender === "agent" && conversationId && (
                <ResponseFeedback
                  messageId={message.id}
                  conversationId={conversationId}
                  originalResponse={message.content}
                  canCorrect={canCorrectResponses}
                />
              )}
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{message.timestamp}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
