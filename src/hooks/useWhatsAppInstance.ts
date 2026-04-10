import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappService, QRCodeResponse, StatusResponse } from "@/services/whatsappService";
import { toast } from "sonner";

export type ConnectionStatus = "disconnected" | "connecting" | "qr_pending" | "connected";

export function useWhatsAppInstance() {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: async (params: { subdomain: string; token: string; instanceId: string; instanceName?: string }) => {
      setConnectionStatus("connecting");
      return whatsappService.connect(params.subdomain, params.token, params.instanceId, params.instanceName);
    },
    onSuccess: (data) => {
      if (data.qrcode || data.base64) {
        setQrCode(data.qrcode || data.base64 || null);
        setConnectionStatus("qr_pending");
      }
    },
    onError: (error) => {
      setConnectionStatus("disconnected");
      toast.error("Erro ao conectar: " + (error as Error).message);
    },
  });

  // Check status mutation
  const checkStatusMutation = useMutation({
    mutationFn: async (params: { subdomain?: string; token?: string; uazapiInstanceId?: string }) => {
      setConnectionStatus("connecting");
      const result = await whatsappService.instanceAction({
        action: "status",
        subdomain: params.subdomain,
        token: params.token,
        instanceId: params.uazapiInstanceId,
      });
      return result as StatusResponse;
    },
    onSuccess: (data) => {
      if (data.state === "connected" || data.connected) {
        setConnectionStatus("connected");
        setQrCode(null);
        setPhone(data.phone || null);
        toast.success("WhatsApp conectado!");
      } else {
        setConnectionStatus("disconnected");
        toast.info(`Status: ${data.state || "desconectado"}`);
      }
    },
    onError: (error) => {
      setConnectionStatus("disconnected");
      toast.error("Erro ao verificar status: " + (error as Error).message);
    },
  });

  // Refresh QR code
  const refreshQRMutation = useMutation({
    mutationFn: async () => {
      setConnectionStatus("connecting");
      return whatsappService.getQRCode();
    },
    onSuccess: (data) => {
      if (data.qrcode || data.base64) {
        setQrCode(data.qrcode || data.base64 || null);
        setConnectionStatus("qr_pending");
      }
    },
    onError: (error) => {
      toast.error("Erro ao atualizar QR: " + (error as Error).message);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => whatsappService.disconnect(),
    onSuccess: () => {
      setConnectionStatus("disconnected");
      setQrCode(null);
      setPhone(null);
      toast.success("WhatsApp desconectado");
    },
    onError: (error) => {
      toast.error("Erro ao desconectar: " + (error as Error).message);
    },
  });

  const connect = useCallback(
    (subdomain: string, token: string, instanceId: string, instanceName?: string) => {
      connectMutation.mutate({ subdomain, token, instanceId, instanceName });
    },
    [connectMutation]
  );

  const disconnect = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  const refreshQR = useCallback(() => {
    refreshQRMutation.mutate();
  }, [refreshQRMutation]);

  const checkStatusWithCredentials = useCallback(
    (subdomain: string, token: string, uazapiInstanceId: string) => {
      checkStatusMutation.mutate({ subdomain, token, uazapiInstanceId });
    },
    [checkStatusMutation]
  );

  return {
    connectionStatus,
    qrCode,
    phone,
    isLoading: connectMutation.isPending || checkStatusMutation.isPending,
    connect,
    disconnect,
    refreshQR,
    checkStatus: () => checkStatusMutation.mutate({}),
    checkStatusWithCredentials,
  };
}
