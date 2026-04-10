import { supabase } from "@/integrations/supabase/client";

export interface SendMessageParams {
  phone: string;
  message?: string;
  type?: "text" | "image" | "audio" | "video" | "document";
  mediaUrl?: string;
  mediaCaption?: string;
  instanceId?: string;
}

export interface InstanceActionParams {
  action: "connect" | "disconnect" | "status" | "qrcode";
  instanceId?: string;
  instanceName?: string;
  subdomain?: string;
  token?: string;
}

export interface QRCodeResponse {
  success?: boolean;
  qrcode?: string;
  base64?: string;
  message?: string;
  state?: string;
}

export interface StatusResponse {
  success?: boolean;
  state?: string;
  phone?: string;
  connected?: boolean;
}

export const whatsappService = {
  async sendMessage(params: SendMessageParams) {
    const { data, error } = await supabase.functions.invoke("whatsapp-send", {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  async instanceAction(params: InstanceActionParams): Promise<QRCodeResponse | StatusResponse> {
    const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  async getQRCode(subdomain?: string, token?: string, instanceId?: string): Promise<QRCodeResponse> {
    return this.instanceAction({ 
      action: "qrcode",
      subdomain,
      token,
      instanceId,
    }) as Promise<QRCodeResponse>;
  },

  async getStatus(instanceId?: string): Promise<StatusResponse> {
    return this.instanceAction({ 
      action: "status",
      instanceId,
    }) as Promise<StatusResponse>;
  },

  async connect(subdomain: string, token: string, instanceId: string, instanceName?: string): Promise<QRCodeResponse> {
    return this.instanceAction({
      action: "connect",
      subdomain,
      token,
      instanceId,
      instanceName,
    }) as Promise<QRCodeResponse>;
  },

  async disconnect(instanceId?: string) {
    return this.instanceAction({
      action: "disconnect",
      instanceId,
    });
  },
};
