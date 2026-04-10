/**
 * PII Masking helpers — LGPD compliance
 *
 * Use em qualquer log que contenha telefone, email ou JID de WhatsApp.
 * Mascara os últimos 4 dígitos/caracteres para preservar rastreabilidade
 * sem expor o dado completo.
 */

/**
 * Mascara um número de telefone preservando DDI/DDD.
 * Ex: "5511999998888" → "551199999****"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "unknown";
  const str = String(phone);
  if (str.length <= 4) return "****";
  return str.slice(0, -4) + "****";
}

/**
 * Mascara um JID de WhatsApp (formato "5511999998888@s.whatsapp.net" ou "...@g.us").
 * Preserva o sufixo do domínio.
 */
export function maskJid(jid: string | null | undefined): string {
  if (!jid) return "unknown";
  const str = String(jid);
  const atIdx = str.indexOf("@");
  if (atIdx === -1) return maskPhone(str);
  return maskPhone(str.slice(0, atIdx)) + str.slice(atIdx);
}

/**
 * Mascara um e-mail preservando domínio.
 * Ex: "marcio@sismais.com.br" → "ma****@sismais.com.br"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "unknown";
  const str = String(email);
  const atIdx = str.indexOf("@");
  if (atIdx === -1) return "****";
  const local = str.slice(0, atIdx);
  const domain = str.slice(atIdx);
  if (local.length <= 2) return "****" + domain;
  return local.slice(0, 2) + "****" + domain;
}

/**
 * Mascara qualquer string PII genérica preservando os 2 primeiros caracteres.
 */
export function maskPII(value: string | null | undefined): string {
  if (!value) return "unknown";
  const str = String(value);
  if (str.length <= 2) return "****";
  return str.slice(0, 2) + "****";
}
