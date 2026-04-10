import { useState, useEffect } from "react";
import type { WhatsAppConfig } from "@/types/whatsapp";

const STORAGE_KEY = "whatsapp_config";

const defaultConfig: WhatsAppConfig = {
  connection: null,
  aiAutomation: {
    enabled: false,
    greetingMessage: "Olá! Bem-vindo ao nosso atendimento. Em que posso ajudar?",
    workingHours: {
      enabled: false,
      start: "08:00",
      end: "18:00",
    },
    autoClassify: true,
    autoRespond: false,
  },
};

export function useWhatsAppConfig() {
  const [config, setConfig] = useState<WhatsAppConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setConfig(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse WhatsApp config:", e);
      }
    }
    setIsLoading(false);
  }, []);

  const updateConfig = (updates: Partial<WhatsAppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  const updateAIAutomation = (updates: Partial<WhatsAppConfig["aiAutomation"]>) => {
    updateConfig({
      aiAutomation: { ...config.aiAutomation, ...updates },
    });
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    config,
    isLoading,
    updateConfig,
    updateAIAutomation,
    resetConfig,
  };
}
