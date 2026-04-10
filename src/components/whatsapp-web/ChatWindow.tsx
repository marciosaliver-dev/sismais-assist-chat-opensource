import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Smile, Paperclip, Mic, Image, FileText, Video, X, Square, Camera, MapPin, User, List, MousePointerClick, Sparkles } from "lucide-react";
import { LinkPreview, extractFirstUrl } from "@/components/inbox/LinkPreview";
import { useContactPicture } from "@/hooks/useContactPicture";
import { WhatsAppAudioPlayer } from "./WhatsAppAudioPlayer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { UazapiChat } from "@/hooks/useUazapiChats";
import type { UazapiMessage } from "@/hooks/useUazapiMessages";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatWindowProps {
  chat: UazapiChat | null;
  messages: UazapiMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, options?: { type?: string; mediaUrl?: string; filename?: string; buttons?: Array<{ id: string; text: string }>; listSections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> }) => void;
  isSending: boolean;
  instanceId?: string;
}

function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "read": return <span className="text-blue-400">✓✓</span>;
    case "delivered": return <span className="text-muted-foreground/70">✓✓</span>;
    case "sent": return <span className="text-muted-foreground/70">✓</span>;
    case "failed": return <span className="text-destructive">✗</span>;
    default: return <span className="text-muted-foreground/50">⏳</span>;
  }
}

// Interactive message rendering
function InteractiveButtons({ buttons }: { buttons: Array<{ id: string; text: string }> }) {
  return (
    <div className="mt-2 space-y-1">
      {buttons.map((btn) => (
        <div key={btn.id} className="text-center text-xs font-medium text-[hsl(var(--whatsapp))] bg-secondary/50 rounded-lg py-2 px-3 cursor-pointer hover:bg-secondary transition-smooth">
          {btn.text}
        </div>
      ))}
    </div>
  );
}

function InteractiveList({ listData }: { listData: { title?: string; sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> } }) {
  return (
    <div className="mt-2 space-y-2">
      {listData.sections?.map((section, i) => (
        <div key={i}>
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{section.title}</p>
          {section.rows?.map((row) => (
            <div key={row.id} className="bg-secondary/50 rounded-lg p-2 mb-1 cursor-pointer hover:bg-secondary transition-smooth">
              <p className="text-xs font-medium text-foreground">{row.title}</p>
              {row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: UazapiMessage }) {
  const isMe = message.from_me;
  const time = format(new Date(message.timestamp), "HH:mm");

  const buttons = message.buttons as Array<{ id: string; text: string }> | null;
  const listData = message.list_data as { title?: string; sections: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }> } | null;

  return (
    <div className={cn("flex mb-1", isMe ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[65%] px-3 py-2 relative", isMe ? "message-outgoing" : "message-incoming")}>
        {!isMe && message.sender_name && (
          <p className="text-xs font-medium text-[hsl(var(--whatsapp))] mb-1">{message.sender_name}</p>
        )}

        {/* Media */}
        {message.type === "image" && message.media_url && (
          <img src={message.media_url} alt="" className="rounded-lg mb-1 max-w-[280px] w-full" />
        )}
        {message.type === "video" && message.media_url && (
          <video src={message.media_url} controls className="rounded-lg mb-1 max-w-full" />
        )}
        {message.type === "audio" && message.media_url && (
          <WhatsAppAudioPlayer src={message.media_url} isMe={isMe} />
        )}
        {message.type === "document" && (
          <a href={message.media_url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2 mb-1 hover:bg-secondary transition-smooth">
            <FileText className="w-8 h-8 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{message.media_filename || "Documento"}</p>
              {message.media_size && <p className="text-xs text-muted-foreground">{(message.media_size / 1024).toFixed(0)} KB</p>}
            </div>
          </a>
        )}
        {message.type === "sticker" && message.media_url && (
          <img src={message.media_url} alt="sticker" className="w-32 h-32 object-contain" />
        )}
        {message.type === "location" && message.location && (
          <div className="bg-secondary/50 rounded-lg p-2 mb-1">
            <MapPin className="w-5 h-5 text-[hsl(var(--whatsapp))] mb-1" />
            <p className="text-xs text-foreground">{(message.location as { address?: string }).address || "Localização"}</p>
          </div>
        )}

        {/* Text */}
        {(message.text_body || message.caption) && (
          <>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{message.text_body || message.caption}</p>
            {(() => {
              const linkUrl = extractFirstUrl(message.text_body || message.caption || "");
              return linkUrl ? <LinkPreview url={linkUrl} /> : null;
            })()}
          </>
        )}

        {/* Interactive: buttons */}
        {buttons && buttons.length > 0 && <InteractiveButtons buttons={buttons} />}

        {/* Interactive: list */}
        {listData && listData.sections && <InteractiveList listData={listData} />}

        {/* Time + status */}
        <div className="flex items-center gap-1 mt-1 justify-end">
          <span className="text-xs text-muted-foreground">{time}</span>
          {isMe && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

// Audio Recorder component
function AudioRecorder({ onRecorded, onCancel }: { onRecorded: (blob: Blob) => void; onCancel: () => void }) {
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let stream: MediaStream;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          onRecorded(blob);
          stream.getTracks().forEach((t) => t.stop());
        };

        recorder.start();
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      } catch {
        onCancel();
      }
    })();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const stop = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const cancel = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    onCancel();
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3 flex-1">
      <Button variant="ghost" size="icon" onClick={cancel} className="text-destructive shrink-0">
        <X className="w-5 h-5" />
      </Button>
      <div className="flex items-center gap-2 flex-1">
        <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
        <span className="text-sm font-mono text-foreground">{formatDuration(duration)}</span>
        <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-destructive/50 animate-pulse" style={{ width: "100%" }} />
        </div>
      </div>
      <Button size="icon" className="shrink-0 bg-[hsl(var(--whatsapp))] hover:bg-[hsl(var(--whatsapp))]/90 text-white" onClick={stop}>
        <Send className="w-5 h-5" />
      </Button>
    </div>
  );
}

// Emoji Picker (simple grid)
const EMOJI_GROUPS = [
  ["😀","😂","🥰","😍","🤩","😎","🤗","🤔","😅","😢","😡","👍","👎","❤️","🔥","🎉","👏","🙏","💪","✅"],
  ["😊","😘","🤣","😜","🙄","😴","🤮","💀","👻","🤖","👋","✌️","🤝","🫶","💯","⭐","🚀","💡","📌","🎯"],
];

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1 p-2 max-h-[200px] overflow-y-auto">
      {EMOJI_GROUPS.flat().map((emoji) => (
        <button key={emoji} onClick={() => onSelect(emoji)} className="w-8 h-8 flex items-center justify-center text-lg hover:bg-secondary rounded transition-smooth">
          {emoji}
        </button>
      ))}
    </div>
  );
}

// Attachment menu
function AttachmentMenu({ onAttach }: { onAttach: (type: string) => void }) {
  const items = [
    { icon: Image, label: "Imagem", type: "image", color: "text-blue-400" },
    { icon: Camera, label: "Câmera", type: "camera", color: "text-pink-400" },
    { icon: FileText, label: "Documento", type: "document", color: "text-purple-400" },
    { icon: Video, label: "Vídeo", type: "video", color: "text-red-400" },
    { icon: MapPin, label: "Localização", type: "location", color: "text-green-400" },
    { icon: User, label: "Contato", type: "contact", color: "text-cyan-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => onAttach(item.type)}
          className="flex flex-col items-center gap-1 p-3 rounded-lg hover:bg-secondary transition-smooth"
        >
          <div className={cn("w-10 h-10 rounded-full bg-secondary flex items-center justify-center", item.color)}>
            <item.icon className="w-5 h-5" />
          </div>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export function ChatWindow({ chat, messages, isLoading, onSendMessage, isSending, instanceId }: ChatWindowProps) {
  const { url: pictureUrl } = useContactPicture(chat?.id, chat?.chat_id, instanceId, chat?.contact_picture_url);
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const activateAIMutation = useMutation({
    mutationFn: async () => {
      if (!chat?.chat_id || !instanceId) throw new Error("Chat ou instância não encontrada");

      let conversationId: string | null = null;

      const { data: conversation, error: findError } = await supabase
        .from("ai_conversations")
        .select("id, handler_type, current_agent_id")
        .eq("uazapi_chat_id", chat.chat_id)
        .maybeSingle();

      if (findError) throw findError;

      if (conversation) {
        conversationId = conversation.id;
        const { error: updateError } = await supabase
          .from("ai_conversations")
          .update({ handler_type: "ai", status: "em_atendimento" })
          .eq("id", conversation.id);

        if (updateError) throw updateError;
      } else {
        const { data: newConv, error: createError } = await supabase
          .from("ai_conversations")
          .insert({
            uazapi_chat_id: chat.chat_id,
            customer_phone: chat.contact_phone,
            customer_name: chat.contact_name,
            whatsapp_instance_id: instanceId,
            handler_type: "ai",
            status: "em_atendimento",
          })
          .select("id")
          .maybeSingle();

        if (createError) throw createError;
        conversationId = newConv?.id || null;
      }

      if (conversationId) {
        const { data: convData, error: convError } = await supabase
          .from("ai_conversations")
          .select("current_agent_id, customer_phone")
          .eq("id", conversationId)
          .single();

        if (convError) throw convError;

        let agentId = convData?.current_agent_id;

        if (!agentId) {
          const { data: orchResult, error: orchError } = await supabase.functions.invoke("orchestrator", {
            body: {
              conversation_id: conversationId,
              message_content: "",
              analysis: { trigger: "ai_activation" },
            },
          });

          if (orchError) {
            console.warn("orchestrator erro:", orchError.message);
          } else if (orchResult?.agent_id) {
            agentId = orchResult.agent_id;
          }
        }

        if (agentId) {
          const { error: execError } = await supabase.functions.invoke("agent-executor", {
            body: {
              conversation_id: conversationId,
              agent_id: agentId,
            },
          });

          if (execError) {
            console.warn("agent-executor retorno:", execError.message);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uazapi-messages", chat?.id] });
      queryClient.invalidateQueries({ queryKey: ["uazapi-chats"] });
      toast.success("IA ativada e respondendo o cliente!");
    },
    onError: (error) => {
      console.error("Erro ao ativar IA:", error);
      toast.error("Erro ao ativar IA");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text.trim());
    setText("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  const handleAttach = (type: string) => {
    // For now, show toast - full implementation would open file picker
    console.log("Attach:", type);
  };

  const handleAudioRecorded = useCallback((blob: Blob) => {
    setIsRecording(false);
    // In a real app, upload blob to storage and send URL
    const url = URL.createObjectURL(blob);
    onSendMessage("[Áudio gravado]", { type: "audio", mediaUrl: url });
  }, [onSendMessage]);

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-64 h-64 mx-auto mb-6 rounded-full bg-secondary/30 flex items-center justify-center">
            <svg className="w-32 h-32 text-muted-foreground/30" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.74.45 3.38 1.24 4.82L2 22l5.18-1.24C8.62 21.55 10.26 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.57 0-3.05-.42-4.33-1.16l-.31-.18L4 20l1.34-3.36-.18-.31C4.42 15.05 4 13.57 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-foreground mb-2">WhatsApp Web - SisCRM</h2>
          <p className="text-muted-foreground text-sm">Selecione uma conversa para começar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Chat header */}
      <div className="h-16 border-b border-border flex items-center px-4 gap-3 bg-card shrink-0">
        <Avatar className="w-10 h-10">
          <AvatarImage src={pictureUrl || undefined} />
          <AvatarFallback className="bg-secondary text-sm">
            {(chat.contact_name || chat.contact_phone || "?")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground truncate">
            {chat.contact_name || chat.contact_phone || chat.chat_id}
          </h3>
          <p className="text-xs text-muted-foreground">{chat.contact_phone || ""}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-[hsl(var(--whatsapp))]/30 text-[hsl(var(--whatsapp))] hover:bg-[hsl(var(--whatsapp))]/10"
          onClick={() => activateAIMutation.mutate()}
          disabled={activateAIMutation.isPending}
        >
          <Sparkles className="w-4 h-4" />
          {activateAIMutation.isPending ? "Ativando..." : "Ativar IA"}
        </Button>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-0.5"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
      >
        {isLoading && <div className="text-center text-muted-foreground text-sm py-8">Carregando mensagens...</div>}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 bg-card shrink-0">
        <div className="flex items-end gap-2">
          {isRecording ? (
            <AudioRecorder onRecorded={handleAudioRecorded} onCancel={() => setIsRecording(false)} />
          ) : (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <Smile className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-[340px] p-0">
                  <EmojiPicker onSelect={handleEmojiSelect} />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-[280px] p-0">
                  <AttachmentMenu onAttach={handleAttach} />
                </PopoverContent>
              </Popover>

              <Textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite uma mensagem..."
                className="flex-1 min-h-[40px] max-h-[120px] resize-none bg-secondary border-none text-sm"
                rows={1}
              />
              {text.trim() ? (
                <Button
                  size="icon"
                  className="shrink-0 bg-[hsl(var(--whatsapp))] hover:bg-[hsl(var(--whatsapp))]/90 text-white"
                  onClick={handleSend}
                  disabled={isSending}
                >
                  <Send className="w-5 h-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsRecording(true)}
                >
                  <Mic className="w-5 h-5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
