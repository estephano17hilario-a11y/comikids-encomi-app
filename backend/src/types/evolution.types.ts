export interface EvolutionMessageKey {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
}

export interface EvolutionImageMessage {
  url?: string;
  mimetype?: string;
  caption?: string;
  fileSha256?: string;
  fileLength?: string | number;
  height?: number;
  width?: number;
  mediaKey?: string;
  directPath?: string;
  jpegThumbnail?: string;
}

export interface EvolutionMessageContent {
  conversation?: string;
  extendedTextMessage?: {
    text: string;
  };
  imageMessage?: EvolutionImageMessage;
  audioMessage?: {
    url?: string;
    mimetype?: string;
    fileSha256?: string;
    fileLength?: string | number;
    seconds?: number;
    ptt?: boolean;
    mediaKey?: string;
  };
  documentMessage?: {
    url?: string;
    mimetype?: string;
    title?: string;
    fileLength?: string | number;
  };
}

export interface EvolutionMessageData {
  key: EvolutionMessageKey;
  pushName?: string;
  message?: EvolutionMessageContent;
  messageType?: string;
  messageTimestamp?: number;
  instanceId?: string;
  source?: string;
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessageData;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

export interface TenantWhatsAppJobData {
  tenantId: string;
  instanceName: string;
  sender: string;
  remoteJid: string;
  messageId: string;
  pushName?: string;
  messageType: string;
  content: string;
  messageData: EvolutionMessageData;
  timestamp: number;
}

export interface CreateTenantInstanceDto {
  tenantId: string;
  storeName?: string;
  webhookUrl?: string;
}

export interface TenantInstanceInfo {
  instanceName: string;
  tenantId: string;
  status: 'connecting' | 'open' | 'close' | 'created';
  qrcode?: {
    pairingCode?: string;
    code?: string;
    base64?: string;
  };
}
