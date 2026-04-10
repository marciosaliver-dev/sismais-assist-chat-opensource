export interface WhatsAppConnection {
  instanceId: string;
  apiToken: string;
  status: "disconnected" | "connecting" | "connected" | "qr_pending";
  phone?: string;
  connectedAt?: string;
}

export interface WhatsAppConfig {
  connection: WhatsAppConnection | null;
  aiAutomation: {
    enabled: boolean;
    greetingMessage: string;
    workingHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    autoClassify: boolean;
    autoRespond: boolean;
  };
}

export interface UazapiQRCodeResponse {
  success: boolean;
  qrcode?: string;
  message?: string;
}

export interface UazapiStatusResponse {
  success: boolean;
  status: string;
  phone?: string;
  connected?: boolean;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  type: "text" | "image" | "audio" | "video" | "document";
  content: string;
  mediaUrl?: string;
  timestamp: string;
}
