import { useState } from "react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatWindow } from "./ChatWindow";
import { ContactInfoPanel } from "./ContactInfoPanel";
import { InstanceSetup } from "./InstanceSetup";
import { useUazapiInstance } from "@/hooks/useUazapiInstance";
import { useUazapiChats, type UazapiChat } from "@/hooks/useUazapiChats";
import { useUazapiMessages } from "@/hooks/useUazapiMessages";
import { Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function WhatsAppWebLayout() {
  const { instance, isLoading: instanceLoading } = useUazapiInstance();
  const [selectedChat, setSelectedChat] = useState<UazapiChat | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const { chats, isLoading: chatsLoading } = useUazapiChats(instance?.id);
  const { messages, isLoading: msgsLoading, sendMessage } = useUazapiMessages(selectedChat?.id);

  const handleSendMessage = (text: string, options?: { type?: string; mediaUrl?: string; filename?: string }) => {
    if (!selectedChat || !instance) return;
    sendMessage.mutate({
      chatJid: selectedChat.chat_id,
      type: options?.type || "text",
      text,
      mediaUrl: options?.mediaUrl,
      filename: options?.filename,
      instanceId: instance.id,
    });
  };

  if (instanceLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!instance || showSetup) {
    return (
      <div className="h-full overflow-y-auto">
        <InstanceSetup />
        {instance && (
          <div className="flex justify-center pb-6">
            <Button variant="outline" onClick={() => setShowSetup(false)}>
              ← Voltar ao chat
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <div className="flex flex-col h-full">
        <div className="h-16 border-b border-border flex items-center justify-between px-4 bg-card w-[320px] shrink-0">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-[hsl(var(--whatsapp))]/20 text-[hsl(var(--whatsapp))]">S</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{instance.profile_name || "SisCRM"}</p>
              <Badge variant="outline" className="text-xs h-4 border-[hsl(var(--success))]/30 text-[hsl(var(--success))]">Conectado</Badge>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setShowSetup(true)} className="text-muted-foreground">
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        <ChatSidebar
          chats={chats}
          selectedChatId={selectedChat?.id || null}
          onSelectChat={(c) => { setSelectedChat(c); setShowInfoPanel(false); }}
          isLoading={chatsLoading}
          instanceId={instance?.id}
        />
      </div>

      <ChatWindow
        chat={selectedChat}
        messages={messages}
        isLoading={msgsLoading}
        onSendMessage={handleSendMessage}
        isSending={sendMessage.isPending}
        instanceId={instance?.id}
      />

      {showInfoPanel && selectedChat && (
        <ContactInfoPanel chat={selectedChat} onClose={() => setShowInfoPanel(false)} />
      )}
    </div>
  );
}
