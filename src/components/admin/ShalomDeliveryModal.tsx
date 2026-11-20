import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { ShalomApiService } from '../../services/shalomApiService';
import { extractShalomDni, extractShalomPhone } from '../../utils/shalomExcelExporter';
import { validateShalomPin, formatShalomPin } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../config/api';
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Smartphone,
  PackageCheck,
  KeyRound,
  MapPin,
  Eye,
  Search,
  Check,
  AlertCircle,
  RefreshCw,
  QrCode,
  MessageCircle,
  Bot,
  FolderInput,
  Ban,
  ShieldCheck,
  FileCheck2,
  Truck,
} from 'lucide-react';

export type DeliveryFolderChoice = 'keep' | 'almacen' | 'alistando' | 'despachando' | 'entregado';
export type BotSendMode = 'only_with_pdf' | 'all' | 'none' | 'custom';

export interface DeliveryCompletionResult {
  botSentIds: string[];
  otherMoves: Array<{
    orderId: string;
    targetFolder: Exclude<DeliveryFolderChoice, 'keep'>;
  }>;
  keptIds: string[];
  updatedMeta: Record<string, { guia?: string; pickupCode?: string; oseId?: string; verifiedInShalom?: boolean }>;
  botMode: BotSendMode;
  summaryText: string;
}

interface ShalomDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Pedido[];
  tallerConfig: TallerConfig;
  onOrdersDelivered?: (
    deliveredIds: string[],
    updatedMeta?: Record<string, { guia?: string; pickupCode?: string; oseId?: string }>
  ) => Promise<void>;
  onDeliveryComplete?: (result: DeliveryCompletionResult) => Promise<void>;
}

export interface DeliveryOrderProgress {
  orderId: string;
  customerName: string;
  phone: string;
  dni: string;
  pickupCode: string;
  trackingCode: string;
  guideNumber?: string;
  oseId?: string;
  manualGuideInput: string;
  agencyName: string;
  agencyBadge: string;
  isShalom: boolean;
  wasRegisteredLocally: boolean;
  currentStageLabel: string;
  shalomApiStatus?: string;
  shalomDocSource?: string;
  fileName?: string;
  auditStatus: 'idle' | 'auditing' | 'verified_pdf' | 'not_found' | 'not_shalom';
  sendStatus: 'idle' | 'sending' | 'completed' | 'skipped' | 'error';
  sendWithBot: boolean;
  nonBotFolderOverride?: DeliveryFolderChoice;
  errorMsg?: string;
  pdfBase64?: string;
}

const isShalomOrder = (o: Pedido) =>
  o.metodo_envio_codigo === 'shalom' || Boolean(o.destino_detalle?.toLowerCase().includes('shalom'));

const getCurrentStageLabel = (o: Pedido): string => {
  if (o.estado_envio === 'entregado') return 'Entregados';
  if (o.estado_envio === 'listo_para_recojo') return 'Listo para recoger';
  if (o.estado_envio === 'en_camino' || (o.estado_produccion === 'completado' && o.estado_envio === 'pendiente')) {
    return 'Despachados';
  }
  if (o.estado_produccion === 'bordando') return 'Alistando';
  return 'Almacén';
};

const FOLDER_OPTIONS: { id: DeliveryFolderChoice; label: string; short: string; emoji: string; cls: string }[] = [
  { id: 'keep', label: 'Dejar donde están', short: 'No mover', emoji: '📌', cls: 'border-slate-600 bg-slate-800/80 text-slate-200' },
  { id: 'entregado', label: 'Entregados', short: 'Entregados', emoji: '✅', cls: 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200' },
  { id: 'despachando', label: 'Despachados', short: 'Despachados', emoji: '🚚', cls: 'border-blue-500/50 bg-blue-500/20 text-blue-200' },
  { id: 'alistando', label: 'Alistando', short: 'Alistando', emoji: '🪡', cls: 'border-purple-500/50 bg-purple-500/20 text-purple-200' },
  { id: 'almacen', label: 'Almacén', short: 'Almacén', emoji: '🏬', cls: 'border-amber-500/50 bg-amber-500/20 text-amber-200' },
];

export const ShalomDeliveryModal: React.FC<ShalomDeliveryModalProps> = ({
  isOpen,
  onClose,
  orders,
  tallerConfig,
  onOrdersDelivered,
  onDeliveryComplete,
}) => {
  const { empresaConfig, currentEmpresa } = useAuth();
  const subInstance =
    currentEmpresa?.config?.vps_instance_name ||
    currentEmpresa?.sub_instance ||
    tallerConfig?.copilot_sub_instance ||
    'tenant_Comikids';
  const rawSender =
    currentEmpresa?.telefono_contacto ||
    tallerConfig?.copilot_owner_phone ||
    tallerConfig?.whatsapp_pedidos ||
    '';
  const initialSenderPhone = rawSender && !rawSender.includes('963097546') ? rawSender : '51927781412';
  const [senderPhone, setSenderPhone] = useState<string>(initialSenderPhone);
  const isVpsWhatsAppEnabled = empresaConfig?.vps_whatsapp_entregado !== false;
  const isShalomExcelMode = empresaConfig?.shalom_modo === 'excel';

  const [processing, setProcessing] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [progressList, setProgressList] = useState<DeliveryOrderProgress[]>([]);
  const [completedSummary, setCompletedSummary] = useState<{
    botSent: number;
    botFailed: number;
    otherMoved: number;
    kept: number;
    done: boolean;
  } | null>(null);
  const [currentStepText, setCurrentStepText] = useState('');
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'verified' | 'missing'>('all');

  // Opciones elegidas por el usuario
  const [botMode, setBotMode] = useState<BotSendMode>(() =>
    isVpsWhatsAppEnabled ? 'only_with_pdf' : 'none'
  );
  const [otherFolderChoice, setOtherFolderChoice] = useState<DeliveryFolderChoice>(() =>
    isVpsWhatsAppEnabled ? 'keep' : 'entregado'
  );

  const registeredPin =
    orders.find(o => o.shalom_clave_recojo && o.shalom_clave_recojo.trim())?.shalom_clave_recojo?.trim() ||
    (orders[0] as any)?.clave_recojo ||
    '0808';
  const [pickupCode, setPickupCode] = useState<string>(() => registeredPin);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const auditedRef = React.useRef(false);
  const cancelledAuditRef = React.useRef(false);

  // Aplicar regla de modo Bot a toda la lista
  const applyBotModeToList = (list: DeliveryOrderProgress[], mode: BotSendMode): DeliveryOrderProgress[] => {
    if (mode === 'custom') return list;
    return list.map(item => ({
      ...item,
      sendWithBot:
        mode === 'only_with_pdf'
          ? item.auditStatus === 'verified_pdf'
          : mode === 'all'
          ? true
          : false,
    }));
  };

  const handleSelectBotMode = (mode: Exclude<BotSendMode, 'custom'>) => {
    setBotMode(mode);
    setProgressList(prev => applyBotModeToList(prev, mode));
    // Si el usuario elige "Ninguno", lo más natural es querer moverlos a Entregados;
    // si elige "Solo con PDF", por defecto dejamos los sin PDF donde están para no perderlos.
    if (mode === 'none' && otherFolderChoice === 'keep') {
      setOtherFolderChoice('entregado');
    } else if (mode === 'only_with_pdf' && otherFolderChoice === 'entregado') {
      setOtherFolderChoice('keep');
    }
  };

  // 1. AUDITORÍA AUTOMÁTICA EN SHALOM PRO API
  const executeAudit = async (targetList: DeliveryOrderProgress[], forceRefresh = false) => {
    if (isShalomExcelMode) {
      const excelList: DeliveryOrderProgress[] = targetList.map(p => ({
        ...p,
        auditStatus: p.isShalom ? 'not_found' : 'not_shalom',
      }));
      setProgressList(applyBotModeToList(excelList, isVpsWhatsAppEnabled ? 'all' : 'none'));
      setBotMode(isVpsWhatsAppEnabled ? 'all' : 'none');
      setIsAuditing(false);
      setCurrentStepText('Modo Solo EXCEL activo (sin conexión API directa a Shalom).');
      return;
    }

    const auth = tallerConfig?.shalom_email
      ? {
          email: tallerConfig.shalom_email,
          password: tallerConfig.shalom_password || '',
        }
      : undefined;

    cancelledAuditRef.current = false;
    const updatedList: DeliveryOrderProgress[] = targetList.map(p => {
      if (!p.isShalom) {
        return { ...p, auditStatus: 'not_shalom' };
      }
      const cleanDni = (p.dni || '').replace(/\D/g, '').trim();
      const hasIdent = Boolean(cleanDni.length >= 6 || p.trackingCode || p.guideNumber || p.manualGuideInput || p.oseId);
      return {
        ...p,
        auditStatus: hasIdent ? 'auditing' : 'not_found',
      };
    });

    setProgressList([...updatedList]);
    const itemsToAudit = updatedList.filter(p => p.auditStatus === 'auditing');

    if (itemsToAudit.length === 0) {
      setIsAuditing(false);
      setCurrentStepText('Revisión completada.');
      return;
    }

    setIsAuditing(true);
    setCurrentStepText(`Examinando envíos en Shalom Pro API (0/${itemsToAudit.length})...`);

    const CONCURRENCY = 3;
    let completedCount = 0;

    const auditSingleItem = async (item: DeliveryOrderProgress, isFirstItem = false) => {
      if (cancelledAuditRef.current) return;
      const originalOrder = orders.find(o => o.id === item.orderId);
      const cleanDni = (item.dni || '').replace(/\D/g, '').trim();
      const clientCtx = {
        dni: cleanDni,
        phone: item.phone,
        name: item.customerName,
        guia: item.manualGuideInput || item.guideNumber,
        orderDate: originalOrder?.created_at || originalOrder?.fecha_limite,
        internalCode: item.trackingCode,
        refresh: forceRefresh && isFirstItem,
      };

      let pdfData: string | null = null;
      const handleMeta = (meta: {
        pickupCode?: string;
        guia?: string;
        oseId?: string;
        shalomStatus?: string;
        docSource?: string;
      }) => {
        if (meta.pickupCode && !item.pickupCode) {
          item.pickupCode = meta.pickupCode;
          if (!pickupCode) setPickupCode(meta.pickupCode);
        }
        if (meta.guia && meta.guia !== 'S/G' && !meta.guia.startsWith('SH-')) {
          item.guideNumber = meta.guia;
          item.manualGuideInput = meta.guia;
          const safeName = item.customerName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
          item.fileName = `Guia_Shalom_${safeName}_${meta.guia}.pdf`;
        }
        if (meta.oseId) item.oseId = meta.oseId;
        if (meta.shalomStatus) item.shalomApiStatus = meta.shalomStatus;
        if (meta.docSource) item.shalomDocSource = meta.docSource;
      };

      const primarySearchKey =
        cleanDni && cleanDni.length >= 8
          ? cleanDni
          : originalOrder?.shalom_ose_id ||
            item.manualGuideInput?.trim() ||
            (item.guideNumber && !item.guideNumber.startsWith('SH-') && item.guideNumber !== 'S/G'
              ? item.guideNumber
              : '') ||
            item.trackingCode ||
            item.orderId;

      try {
        pdfData = await ShalomApiService.fetchVoucherPdfBase64(primarySearchKey, auth, clientCtx, handleMeta);
      } catch (e: any) {
        console.warn(`[SHALOM AUDIT ERROR] #${item.trackingCode}:`, e?.message);
      }

      if (cancelledAuditRef.current) return;

      if (pdfData && pdfData.length > 100) {
        item.pdfBase64 = pdfData;
        item.auditStatus = 'verified_pdf';
      } else {
        item.pdfBase64 = undefined;
        item.auditStatus = 'not_found';
      }

      completedCount++;
      if (!cancelledAuditRef.current) {
        setProgressList([...updatedList]);
        setCurrentStepText(`Examinando envíos en Shalom Pro API (${completedCount}/${itemsToAudit.length})...`);
      }
    };

    let startIndex = 0;
    if (forceRefresh && itemsToAudit.length > 0) {
      await auditSingleItem(itemsToAudit[0], true);
      startIndex = 1;
    }

    for (let i = startIndex; i < itemsToAudit.length; i += CONCURRENCY) {
      if (cancelledAuditRef.current) break;
      const chunk = itemsToAudit.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(it => auditSingleItem(it, false)));
    }

    if (!cancelledAuditRef.current) {
      setIsAuditing(false);
      const verified = updatedList.filter(p => p.auditStatus === 'verified_pdf').length;
      const defaultMode: BotSendMode = !isVpsWhatsAppEnabled
        ? 'none'
        : verified > 0
        ? 'only_with_pdf'
        : 'none';
      setBotMode(defaultMode);
      setOtherFolderChoice(defaultMode === 'none' ? 'entregado' : 'keep');
      setProgressList(applyBotModeToList(updatedList, defaultMode));
      setCurrentStepText(
        verified === updatedList.length
          ? `Todos los pedidos (${verified}/${updatedList.length}) tienen envío confirmado con PDF en Shalom Pro.`
          : verified > 0
          ? `${verified} con envío confirmado en Shalom Pro · ${updatedList.length - verified} sin envío o sin PDF.`
          : `Ninguno apareció con PDF oficial en Shalom Pro. Puedes buscar por DNI/guía o elegir cómo continuar.`
      );
    }
  };

  useEffect(() => {
    if (!isOpen) {
      auditedRef.current = false;
      cancelledAuditRef.current = true;
      setCompletedSummary(null);
      setListFilter('all');
      return;
    }

    if (auditedRef.current) return;
    auditedRef.current = true;
    cancelledAuditRef.current = false;

    const initialFoundPin =
      orders.find(o => o.shalom_clave_recojo && o.shalom_clave_recojo.trim())?.shalom_clave_recojo?.trim() ||
      (orders[0] as any)?.clave_recojo ||
      '0808';
    setPickupCode(initialFoundPin);

    const initial: DeliveryOrderProgress[] = orders.map(o => {
      const shalom = isShalomOrder(o);
      const clientName = o.usuario?.nombre_completo || (o as any).nombre_cliente || 'Clienta';
      const cleanPhone =
        extractShalomPhone(o) ||
        (o.usuario?.telefono_default || (o as any).telefono_contacto || (o.usuario as any)?.telefono || '').replace(
          /[^0-9]/g,
          ''
        );
      let dni = extractShalomDni(o) || o.usuario?.dni || o.usuario?.dni_default || (o as any).dni_contacto || '';
      if (!dni || dni.startsWith('usr-') || dni === '00000000' || dni === 'NCIADOS') {
        const matchDoc = String(o.destino_detalle || '').match(
          /\b(?:DNI[\s/]*CE|DNI|CE|C\.?E\.?|Doc|Documento|RUC)\b[\s:#]*(?:Recojo:?\s*)?([A-Za-z0-9]{6,12})\b/i
        );
        const docCandidate = matchDoc && matchDoc[1] ? matchDoc[1].trim() : '';
        dni =
          docCandidate &&
          !docCandidate.startsWith('usr-') &&
          docCandidate.toUpperCase() !== 'NCIADOS' &&
          docCandidate.replace(/\D/g, '').length >= 6
            ? docCandidate
            : '';
      }
      const safeName = clientName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
      const fileName = `Guia_Shalom_${safeName}_${cleanPhone.slice(-9)}.pdf`;
      const isRealShalomGuide = Boolean(
        o.shalom_numero_guia && o.shalom_numero_guia !== 'S/G' && !o.shalom_numero_guia.startsWith('SH-')
      );
      const guideNumber = isRealShalomGuide ? o.shalom_numero_guia! : undefined;
      const manualGuideInput = isRealShalomGuide ? o.shalom_numero_guia! : '';
      const orderPickupCode = o.shalom_clave_recojo || (o as any).clave_recojo || initialFoundPin;

      const cleanDni = dni.replace(/\D/g, '').trim();
      const hasIdent = Boolean(cleanDni.length >= 6 || o.codigo_seguimiento || o.shalom_numero_guia || o.shalom_ose_id);
      const wasRegisteredLocally = Boolean(o.registrado_shalom || o.shalom_ose_id || isRealShalomGuide);

      return {
        orderId: o.id,
        customerName: clientName,
        phone: cleanPhone,
        dni,
        trackingCode: o.codigo_seguimiento || o.id,
        guideNumber,
        oseId: o.shalom_ose_id || undefined,
        manualGuideInput,
        agencyName: o.destino_detalle || (shalom ? 'Agencia Shalom' : o.metodo_envio_nombre || 'Envío'),
        agencyBadge: shalom ? 'Shalom' : o.metodo_envio_nombre || o.metodo_envio_codigo || 'Agencia',
        isShalom: shalom,
        wasRegisteredLocally,
        currentStageLabel: getCurrentStageLabel(o),
        fileName,
        pickupCode: orderPickupCode,
        auditStatus: !shalom ? 'not_shalom' : hasIdent ? 'auditing' : 'not_found',
        sendStatus: 'idle',
        sendWithBot: false,
      };
    });

    setProgressList(initial);
    executeAudit(initial, true);

    fetch(`${getApiBaseUrl()}/tenant/${subInstance}/status`)
      .then(res => res.json())
      .then(json => {
        if (json?.data?.ownerPhone) {
          const clean = String(json.data.ownerPhone).replace(/\D/g, '');
          if (clean && !clean.includes('963097546')) {
            setSenderPhone(clean);
          }
        }
      })
      .catch(() => {});
  }, [isOpen, subInstance]);

  // Estadísticas en vivo
  const stats = useMemo(() => {
    const total = progressList.length;
    const verified = progressList.filter(p => p.auditStatus === 'verified_pdf').length;
    const missing = total - verified;
    const botSelected = progressList.filter(p => p.sendWithBot).length;
    const botWithPdf = progressList.filter(p => p.sendWithBot && p.auditStatus === 'verified_pdf').length;
    const botWithoutPdf = botSelected - botWithPdf;
    const nonBotCount = total - botSelected;
    return { total, verified, missing, botSelected, botWithPdf, botWithoutPdf, nonBotCount };
  }, [progressList]);

  const visibleItems = useMemo(() => {
    if (listFilter === 'verified') return progressList.filter(p => p.auditStatus === 'verified_pdf');
    if (listFilter === 'missing') return progressList.filter(p => p.auditStatus !== 'verified_pdf');
    return progressList;
  }, [progressList, listFilter]);

  if (!isOpen) return null;

  const handleOpenQrModal = async () => {
    setQrLoading(true);
    setShowQrModal(true);
    setQrBase64(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/tenant/${subInstance}/qr`);
      const json = await res.json().catch(() => ({}));
      if (json.success && (json.data?.qrcode?.base64 || json.data?.base64)) {
        setQrBase64(json.data.qrcode?.base64 || json.data.base64);
      } else {
        alert('No se pudo generar el código QR. Intenta nuevamente.');
      }
    } catch (e: any) {
      alert(`Error obteniendo QR: ${e.message}`);
    } finally {
      setQrLoading(false);
    }
  };

  const handleManualSearch = async (item: DeliveryOrderProgress) => {
    const cleanDni = (item.dni || '').replace(/\D/g, '').trim();
    const cleanGuide = (item.manualGuideInput || '').trim();
    const keyToSearch = cleanDni && cleanDni.length >= 8 ? cleanDni : cleanGuide || item.trackingCode || item.orderId;
    if (!keyToSearch) return;

    setSearchingId(item.orderId);
    const auth = tallerConfig?.shalom_email
      ? {
          email: tallerConfig.shalom_email,
          password: tallerConfig.shalom_password || '',
        }
      : undefined;

    const originalOrder = orders.find(o => o.id === item.orderId);
    const clientCtx = {
      dni: cleanDni,
      phone: item.phone,
      name: item.customerName,
      guia: cleanGuide || item.guideNumber,
      orderDate: originalOrder?.created_at || originalOrder?.fecha_limite,
      internalCode: item.trackingCode,
      refresh: true,
    };

    const handleMeta = (meta: {
      pickupCode?: string;
      guia?: string;
      oseId?: string;
      shalomStatus?: string;
      docSource?: string;
    }) => {
      if (meta.pickupCode && !item.pickupCode) item.pickupCode = meta.pickupCode;
      if (meta.guia && meta.guia !== 'S/G' && !meta.guia.startsWith('SH-')) {
        item.guideNumber = meta.guia;
        item.manualGuideInput = meta.guia;
        const safeName = item.customerName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_]/g, '_');
        item.fileName = `Guia_Shalom_${safeName}_${meta.guia}.pdf`;
      }
      if (meta.oseId) item.oseId = meta.oseId;
      if (meta.shalomStatus) item.shalomApiStatus = meta.shalomStatus;
      if (meta.docSource) item.shalomDocSource = meta.docSource;
    };

    try {
      const pdfData = await ShalomApiService.fetchVoucherPdfBase64(keyToSearch, auth, clientCtx, handleMeta);
      if (pdfData && pdfData.length > 100) {
        item.pdfBase64 = pdfData;
        item.auditStatus = 'verified_pdf';
        if (botMode === 'only_with_pdf' || botMode === 'all') {
          item.sendWithBot = true;
        }
        setProgressList([...progressList]);
      } else {
        alert(
          `No se encontró guía/PDF en Shalom Pro para "${keyToSearch}" (DNI: ${cleanDni || 'sin DNI'}). Verifica si el paquete ya fue dejado en agencia.`
        );
      }
    } catch (err: any) {
      alert(`Error consultando Shalom Pro: ${err.message}`);
    } finally {
      setSearchingId(null);
    }
  };

  const handleDownloadPdfPreview = (item: DeliveryOrderProgress) => {
    if (!item.pdfBase64) return;
    try {
      const byteCharacters = atob(item.pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteNumbers.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = item.fileName || 'guia_shalom.pdf';
        a.click();
      }
    } catch (err) {
      console.error('Error abriendo preview PDF:', err);
    }
  };

  const toggleItemBot = (orderId: string) => {
    if (processing) return;
    setBotMode('custom');
    setProgressList(prev =>
      prev.map(it => (it.orderId === orderId ? { ...it, sendWithBot: !it.sendWithBot } : it))
    );
  };

  const setItemFolderOverride = (orderId: string, folder: DeliveryFolderChoice) => {
    if (processing) return;
    setProgressList(prev =>
      prev.map(it => (it.orderId === orderId ? { ...it, nonBotFolderOverride: folder } : it))
    );
  };

  // EJECUCIÓN PRINCIPAL: Envía por Bot a los seleccionados + mueve automáticamente enviados + mueve los demás según elección
  const handleConfirmExecution = async () => {
    cancelledAuditRef.current = true;
    setIsAuditing(false);
    setProcessing(true);
    setCompletedSummary(null);

    const updatedList = progressList.map(p => ({ ...p }));
    const toSendByBot = isVpsWhatsAppEnabled ? updatedList.filter(p => p.sendWithBot) : [];
    const displayPhone = senderPhone ? `(+${senderPhone.replace(/^51/, '')})` : '';
    let firstFatalError: string | null = null;
    let botSentCount = 0;
    let botFailedCount = 0;

    // 1. Enviar por WhatsApp Bot solo a los elegidos (uno por uno con protección anti-ban)
    for (let i = 0; i < toSendByBot.length; i++) {
      const item = toSendByBot[i];
      item.sendStatus = 'sending';
      item.errorMsg = undefined;
      setProgressList([...updatedList]);

      if (i > 0) {
        const antiBanDelay = Math.floor(Math.random() * 1400) + 2300;
        setCurrentStepText(
          `Anti-Ban: esperando ${(antiBanDelay / 1000).toFixed(1)}s antes de enviar a ${item.customerName} (${i + 1}/${toSendByBot.length})...`
        );
        await new Promise(r => setTimeout(r, antiBanDelay));
      }

      setCurrentStepText(
        `Enviando ${item.pdfBase64 ? 'PDF oficial' : 'aviso'} (${i + 1}/${toSendByBot.length}) a ${item.customerName} ${displayPhone}...`
      );

      const rawCode = String(item.trackingCode || '').trim();
      const numbersOnly = rawCode.replace(/^[^\d]*/, '').replace(/\D/g, '') || rawCode;
      const itemPickupCode = item.pickupCode || pickupCode;

      const singleOrderPayload = [
        {
          orderId: item.orderId,
          pedidoId: item.orderId,
          phone: item.phone,
          customerName: item.customerName,
          dni: item.dni,
          trackingCode: item.trackingCode || numbersOnly || '',
          guideNumber: item.manualGuideInput || item.guideNumber || item.trackingCode || '',
          agencyName: item.agencyName || 'Agencia Shalom',
          orderCode: numbersOnly,
          pdfBase64: item.pdfBase64 || undefined,
          fileName: item.pdfBase64 ? item.fileName || 'guia_shalom.pdf' : undefined,
          pickupCode: itemPickupCode,
        },
      ];

      const sendRes = await ShalomApiService.sendDeliveryVouchers(singleOrderPayload, itemPickupCode, subInstance);

      if (!sendRes.success) {
        const errorMsg = sendRes.error || 'No se pudo enviar por WhatsApp.';
        item.sendStatus = 'error';
        item.errorMsg = errorMsg;
        botFailedCount++;
        setProgressList([...updatedList]);

        if (errorMsg.toLowerCase().includes('no está conectada') || errorMsg.toLowerCase().includes('sub-qr')) {
          firstFatalError = errorMsg;
          for (let j = i + 1; j < toSendByBot.length; j++) {
            toSendByBot[j].sendStatus = 'error';
            toSendByBot[j].errorMsg = errorMsg;
            botFailedCount++;
          }
          setProgressList([...updatedList]);
          break;
        }
        continue;
      }

      const resItem = sendRes.results?.[0];
      if (resItem && resItem.status === 'error') {
        item.sendStatus = 'error';
        item.errorMsg = resItem.error || 'Error al enviar por WhatsApp';
        botFailedCount++;
      } else {
        item.sendStatus = 'completed';
        if (resItem?.guideNumber && resItem.guideNumber !== 'S/G') item.guideNumber = resItem.guideNumber;
        if (resItem?.pickupCode) item.pickupCode = resItem.pickupCode;
        botSentCount++;
      }
      setProgressList([...updatedList]);
    }

    // Marcar explícitamente los omitidos
    for (const item of updatedList) {
      if (!item.sendWithBot && item.sendStatus === 'idle') {
        item.sendStatus = 'skipped';
      }
    }
    setProgressList([...updatedList]);

    // 2. Construir mapa de movimientos:
    //    - Enviados por bot exitosamente -> SIEMPRE se mueven automáticamente a 'entregado'
    //    - Los demás (no enviados por bot) -> se mueven según la elección del usuario (individual o general)
    //    - Los que fallaron al enviar por bot -> se quedan donde están para que no se pierdan
    const botSentIds: string[] = [];
    const otherMoves: Array<{ orderId: string; targetFolder: Exclude<DeliveryFolderChoice, 'keep'> }> = [];
    const keptIds: string[] = [];
    const updatedMeta: Record<string, { guia?: string; pickupCode?: string; oseId?: string; verifiedInShalom?: boolean }> = {};

    for (const item of updatedList) {
      const realGuia =
        item.manualGuideInput?.trim() ||
        (item.guideNumber && item.guideNumber !== 'S/G' && !item.guideNumber.startsWith('SH-')
          ? item.guideNumber
          : undefined);
      const pinToSave = item.pickupCode || pickupCode || undefined;

      if (realGuia || pinToSave || item.oseId || item.auditStatus === 'verified_pdf') {
        updatedMeta[item.orderId] = {
          guia: realGuia,
          pickupCode: pinToSave,
          oseId: item.oseId,
          verifiedInShalom: item.auditStatus === 'verified_pdf',
        };
      }

      if (item.sendStatus === 'completed') {
        botSentIds.push(item.orderId);
      } else if (item.sendStatus === 'error') {
        // Falló el envío del bot: mantener donde está para revisión
        keptIds.push(item.orderId);
      } else {
        // No se envió por bot: aplicar carpeta elegida por el usuario
        const target = item.nonBotFolderOverride || otherFolderChoice;
        if (target === 'keep') {
          keptIds.push(item.orderId);
        } else {
          otherMoves.push({ orderId: item.orderId, targetFolder: target });
        }
      }
    }

    const parts: string[] = [];
    if (botSentIds.length > 0) parts.push(`${botSentIds.length} enviados por bot → Entregados`);
    if (otherMoves.length > 0) {
      const folderLabel = FOLDER_OPTIONS.find(f => f.id === otherFolderChoice)?.label || 'carpeta elegida';
      parts.push(`${otherMoves.length} movidos a ${folderLabel}`);
    }
    if (keptIds.length > 0) parts.push(`${keptIds.length} sin mover`);
    const summaryText = parts.join(' · ') || 'Sin cambios aplicados';

    // 3. Persistir los movimientos en la app
    try {
      if (onDeliveryComplete) {
        await onDeliveryComplete({
          botSentIds,
          otherMoves,
          keptIds,
          updatedMeta,
          botMode,
          summaryText,
        });
      } else if (onOrdersDelivered) {
        const deliveredIds = [
          ...botSentIds,
          ...otherMoves.filter(m => m.targetFolder === 'entregado').map(m => m.orderId),
        ];
        if (deliveredIds.length > 0) {
          await onOrdersDelivered(deliveredIds, updatedMeta);
        }
      }
    } catch (err) {
      console.error('Error guardando entrega:', err);
    }

    setProcessing(false);

    if (firstFatalError) {
      setCurrentStepText(`⚠️ ${firstFatalError}`);
      alert(`⚠️ ${firstFatalError}`);
    } else {
      setCurrentStepText(summaryText);
    }

    setCompletedSummary({
      botSent: botSentCount,
      botFailed: botFailedCount,
      otherMoved: otherMoves.length,
      kept: keptIds.length,
      done: true,
    });

    // Si todo se procesó sin errores y no hubo envío lento por bot, cerrar automáticamente
    if (botSentCount === 0 && botFailedCount === 0 && !firstFatalError) {
      onClose();
    }
  };

  // Texto claro para el botón principal
  const primaryActionLabel = (() => {
    if (processing) return 'Procesando envíos...';
    if (isAuditing) return 'Revisando en Shalom...';
    if (stats.botSelected > 0) {
      const extra =
        stats.nonBotCount > 0
          ? otherFolderChoice === 'keep'
            ? ` (${stats.nonBotCount} sin mover)`
            : ` + mover ${stats.nonBotCount}`
          : '';
      return `Enviar ${stats.botSelected} por Bot y Entregar${extra}`;
    }
    if (otherFolderChoice === 'keep') {
      return 'Cerrar sin hacer cambios';
    }
    const targetName = FOLDER_OPTIONS.find(f => f.id === otherFolderChoice)?.label || 'Entregados';
    return `Mover ${stats.total} a ${targetName} (sin bot)`;
  })();

  const canConfirm = !processing && !isAuditing;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn"
      data-no-print="true"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Revisar y entregar pedidos"
        className="bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[94dvh] max-h-[94dvh] sm:h-auto sm:max-h-[90vh]"
      >
        {/* Header limpio y compacto */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/25 shrink-0">
              <PackageCheck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                Revisión y Entrega ({stats.total} {stats.total === 1 ? 'pedido' : 'pedidos'})
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span className="text-[11px] text-indigo-300 font-semibold truncate">
                  Bot: {subInstance}
                  {senderPhone ? ` · +${senderPhone.replace(/^51/, '51 ')}` : ''}
                </span>
                <button
                  type="button"
                  onClick={handleOpenQrModal}
                  className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 rounded-full inline-flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3 h-3" />
                  QR
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="min-w-10 min-h-10 flex items-center justify-center text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3.5 flex-1 min-h-0 custom-scrollbar overscroll-contain">
          {/* 1. RESUMEN DE AUDITORÍA SHALOM PRO / API */}
          <div className="rounded-2xl bg-slate-950/70 border border-white/10 p-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setListFilter(f => (f === 'verified' ? 'all' : 'verified'))}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  listFilter === 'verified'
                    ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400'
                    : 'bg-emerald-950/30 border-emerald-500/30 hover:bg-emerald-950/50'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                  <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Con PDF Shalom</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-300 leading-tight mt-0.5">
                  {stats.verified}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setListFilter(f => (f === 'missing' ? 'all' : 'missing'))}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  listFilter === 'missing'
                    ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-amber-950/30 border-amber-500/30 hover:bg-amber-950/50'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Sin envío / PDF</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-300 leading-tight mt-0.5">
                  {stats.missing}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setListFilter('all')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  listFilter === 'all'
                    ? 'bg-cyan-500/15 border-cyan-400/60'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-bold text-slate-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">Total revisión</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-white leading-tight mt-0.5">
                  {stats.total}
                </div>
              </button>
            </div>

            {/* Barra de estado + PIN + Refrescar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isAuditing ? (
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                ) : stats.missing === 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span className="text-xs text-slate-200 font-medium leading-snug">
                  {currentStepText || 'Listo para revisar envíos'}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Clave PIN global compacta */}
                <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/40 rounded-xl px-2 py-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold text-slate-300">PIN:</span>
                  <input
                    type="text"
                    maxLength={4}
                    value={pickupCode}
                    onChange={e => {
                      const val = formatShalomPin(e.target.value);
                      setPickupCode(val);
                      setProgressList(prev => prev.map(p => ({ ...p, pickupCode: val })));
                    }}
                    className={`w-12 bg-slate-950 rounded-md px-1 py-0.5 font-mono font-black text-center text-xs focus:outline-none ${
                      validateShalomPin(pickupCode).isValid ? 'text-amber-300' : 'text-rose-400'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => executeAudit(progressList, true)}
                  disabled={isAuditing || processing}
                  className="min-h-8 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  title="Volver a consultar Shalom Pro API"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                  <span>Refrescar</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. OPCIONES DEL BOT DE WHATSAPP (Solo si no terminó todavía) */}
          {!completedSummary && (
            <div className="rounded-2xl bg-slate-950/70 border border-indigo-500/30 p-3 sm:p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    1. ¿A quién enviar el PDF con el Bot?
                  </h4>
                </div>
                {botMode === 'custom' && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/40">
                    Selección manual ({stats.botSelected})
                  </span>
                )}
              </div>

              {isVpsWhatsAppEnabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={processing || isAuditing}
                    onClick={() => handleSelectBotMode('only_with_pdf')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 ${
                      botMode === 'only_with_pdf'
                        ? 'bg-emerald-500/20 border-emerald-400 ring-1 ring-emerald-400 text-white'
                        : 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black">Solo los que tienen PDF</span>
                      {botMode === 'only_with_pdf' && <Check className="w-4 h-4 text-emerald-300 shrink-0" />}
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      Envía a {stats.verified} · omite {stats.missing} sin PDF
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={processing || isAuditing}
                    onClick={() => handleSelectBotMode('all')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 ${
                      botMode === 'all'
                        ? 'bg-indigo-500/25 border-indigo-400 ring-1 ring-indigo-400 text-white'
                        : 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black">A todos ({stats.total})</span>
                      {botMode === 'all' && <Check className="w-4 h-4 text-indigo-300 shrink-0" />}
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      PDF a {stats.verified} + aviso de texto a {stats.missing}
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={processing || isAuditing}
                    onClick={() => handleSelectBotMode('none')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-50 ${
                      botMode === 'none'
                        ? 'bg-slate-700/80 border-slate-400 ring-1 ring-slate-300 text-white'
                        : 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5" />
                        A ninguno
                      </span>
                      {botMode === 'none' && <Check className="w-4 h-4 text-white shrink-0" />}
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      No envía mensajes, solo mueve carpetas
                    </p>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5">
                  El envío automático por WhatsApp Bot está desactivado en tu empresa. Solo se moverán las carpetas.
                </p>
              )}

              {/* 3. MOVIMIENTO AUTOMÁTICO + CARPETA PARA LOS DEMÁS */}
              <div className="pt-2.5 border-t border-white/10 space-y-2.5">
                <div className="flex items-center gap-2">
                  <FolderInput className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs sm:text-sm font-black text-white">
                    2. ¿A qué carpeta mover los pedidos?
                  </h4>
                </div>

                {stats.botSelected > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Los <strong className="text-white">{stats.botSelected}</strong> enviados por Bot se moverán{' '}
                      <strong className="text-emerald-300">automáticamente a Entregados</strong>.
                    </span>
                  </div>
                )}

                {stats.nonBotCount > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-300">
                      {stats.botSelected > 0
                        ? `¿Qué hacer con los otros ${stats.nonBotCount} que NO van por Bot?`
                        : `¿A qué carpeta mover los ${stats.nonBotCount} pedidos?`}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {FOLDER_OPTIONS.map(opt => {
                        const isSelected = otherFolderChoice === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={processing}
                            onClick={() => setOtherFolderChoice(opt.id)}
                            className={`min-h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                              isSelected
                                ? `${opt.cls} ring-2 ring-white/40 font-black`
                                : 'bg-slate-900/70 border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span>{opt.emoji}</span>
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Banner de resultado final */}
          {completedSummary && (
            <div
              className={`rounded-2xl p-4 border space-y-1.5 ${
                completedSummary.botFailed > 0
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-100'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
              }`}
            >
              <div className="flex items-center gap-2">
                {completedSummary.botFailed > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                )}
                <h4 className="text-sm font-black text-white">
                  {completedSummary.botFailed > 0
                    ? 'Proceso completado con alertas'
                    : '¡Entrega completada con éxito!'}
                </h4>
              </div>
              <p className="text-xs leading-relaxed opacity-90">
                {completedSummary.botSent > 0 && (
                  <>
                    ✅ <strong>{completedSummary.botSent}</strong> enviado(s) por bot y movidos a{' '}
                    <strong>Entregados</strong>.{' '}
                  </>
                )}
                {completedSummary.otherMoved > 0 && (
                  <>
                    📁 <strong>{completedSummary.otherMoved}</strong> movido(s) a tu carpeta elegida.{' '}
                  </>
                )}
                {completedSummary.kept > 0 && (
                  <>
                    📌 <strong>{completedSummary.kept}</strong> se mantuvieron en su carpeta actual.{' '}
                  </>
                )}
                {completedSummary.botFailed > 0 && (
                  <>
                    ⚠️ <strong>{completedSummary.botFailed}</strong> tuvieron error de envío y no se movieron.
                  </>
                )}
              </p>
            </div>
          )}

          {/* 3. LISTADO DETALLADO DE CADA PEDIDO */}
          <div className="space-y-2.5">
            {listFilter !== 'all' && (
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>
                  Mostrando solo:{' '}
                  <strong className="text-white">
                    {listFilter === 'verified' ? 'Con PDF confirmado' : 'Sin envío / sin PDF'}
                  </strong>{' '}
                  ({visibleItems.length})
                </span>
                <button
                  type="button"
                  onClick={() => setListFilter('all')}
                  className="text-cyan-300 font-bold hover:underline cursor-pointer"
                >
                  Ver todos
                </button>
              </div>
            )}

            {visibleItems.map((item, idx) => {
              const effectiveNonBotFolder = item.nonBotFolderOverride || otherFolderChoice;
              const effectiveFolderOption = FOLDER_OPTIONS.find(f => f.id === effectiveNonBotFolder);

              return (
                <div
                  key={item.orderId}
                  className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                    item.sendStatus === 'completed'
                      ? 'bg-emerald-950/35 border-emerald-500/50'
                      : item.sendStatus === 'error'
                      ? 'bg-rose-950/35 border-rose-500/50'
                      : item.auditStatus === 'verified_pdf'
                      ? 'bg-slate-800/80 border-emerald-500/35'
                      : 'bg-slate-800/55 border-amber-500/35'
                  }`}
                >
                  {/* Fila superior: Cliente + Toggle Bot */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-500">#{idx + 1}</span>
                        <span className="text-sm font-black text-white truncate">{item.customerName}</span>
                        <span className="text-[10px] font-mono font-bold bg-cyan-950/70 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-700/40">
                          #{item.trackingCode}
                        </span>
                        <span className="text-[10px] font-bold bg-white/5 text-slate-300 px-1.5 py-0.5 rounded border border-white/10">
                          {item.currentStageLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1 text-slate-300">
                          <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate max-w-[190px] sm:max-w-[260px]">{item.agencyName}</span>
                        </span>
                        {item.phone && <span className="font-mono text-slate-400">+{item.phone}</span>}
                      </div>
                    </div>

                    {/* Botón individual: ¿Enviar con Bot? */}
                    {isVpsWhatsAppEnabled && !completedSummary && (
                      <button
                        type="button"
                        disabled={processing || isAuditing}
                        onClick={() => toggleItemBot(item.orderId)}
                        className={`shrink-0 min-h-9 px-2.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 ${
                          item.sendWithBot
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/25'
                            : 'bg-slate-900/90 text-slate-400 border-white/10 hover:text-white'
                        }`}
                        title="Activar o desactivar envío automático por Bot para esta clienta"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>{item.sendWithBot ? 'Bot: SÍ' : 'Bot: NO'}</span>
                      </button>
                    )}
                  </div>

                  {/* Estado de Auditoría en Shalom Pro / API */}
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-white/8 space-y-2">
                    {item.auditStatus === 'auditing' && (
                      <div className="flex items-center gap-2 text-xs text-indigo-300 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                        <span>Buscando envío en Shalom Pro API (DNI {item.dni || 'sin DNI'})...</span>
                      </div>
                    )}

                    {item.auditStatus === 'verified_pdf' && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-300 bg-emerald-500/15 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                            <Check className="w-3.5 h-3.5" />
                            Envío confirmado en Shalom Pro
                          </span>
                          {item.guideNumber && (
                            <span className="text-[11px] font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-white/10">
                              Guía: {item.guideNumber}
                            </span>
                          )}
                          {item.oseId && (
                            <span className="text-[10px] font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10">
                              OSE #{item.oseId}
                            </span>
                          )}
                          {item.shalomApiStatus && (
                            <span className="text-[10px] font-bold uppercase text-cyan-200 bg-cyan-950/60 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                              {item.shalomApiStatus}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdfPreview(item)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300 hover:text-white bg-cyan-950/80 hover:bg-cyan-900 px-2.5 py-1 rounded-lg border border-cyan-700/50 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            Ver PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManualSearch(item)}
                            disabled={searchingId === item.orderId || processing}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded-lg border border-slate-600/50 cursor-pointer"
                            title="Re-consultar en Shalom Pro"
                          >
                            <RefreshCw
                              className={`w-3 h-3 text-amber-400 ${searchingId === item.orderId ? 'animate-spin' : ''}`}
                            />
                          </button>
                        </div>
                      </div>
                    )}

                    {item.auditStatus === 'not_found' && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border ${
                              item.wasRegisteredLocally
                                ? 'text-amber-200 bg-amber-500/15 border-amber-500/40'
                                : 'text-rose-200 bg-rose-500/15 border-rose-500/40'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {item.wasRegisteredLocally
                              ? 'Registrado en app, pero SIN PDF/envío hallado en Shalom Pro'
                              : 'NO registrado ni enviado en Shalom Pro'}
                          </span>
                          {item.guideNumber && (
                            <span className="text-[10px] font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10">
                              Guía local: {item.guideNumber}
                            </span>
                          )}
                        </div>

                        {/* Búsqueda manual rápida por DNI o Guía */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="text"
                            maxLength={12}
                            value={item.dni}
                            onChange={e => {
                              item.dni = e.target.value.replace(/\D/g, '');
                              setProgressList([...progressList]);
                            }}
                            placeholder="DNI"
                            className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-cyan-300 font-mono font-bold focus:outline-none focus:border-cyan-400"
                          />
                          <input
                            type="text"
                            value={item.manualGuideInput}
                            onChange={e => {
                              item.manualGuideInput = e.target.value;
                              setProgressList([...progressList]);
                            }}
                            placeholder="N° Guía Shalom"
                            className="flex-1 min-w-[120px] bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleManualSearch(item)}
                            disabled={searchingId === item.orderId || processing}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50 cursor-pointer shrink-0"
                          >
                            {searchingId === item.orderId ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Search className="w-3 h-3" />
                            )}
                            Buscar
                          </button>
                        </div>
                      </div>
                    )}

                    {item.auditStatus === 'not_shalom' && (
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>
                          Envío por <strong className="text-white">{item.agencyBadge}</strong> (no usa PDF de Shalom Pro).
                        </span>
                      </div>
                    )}

                    {/* Pie de la tarjeta: Destino de carpeta + PIN + WA directo + Estado de envío */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/5 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.sendWithBot && !completedSummary ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Auto → Entregados
                          </span>
                        ) : !completedSummary ? (
                          <label className="inline-flex items-center gap-1.5 text-slate-300">
                            <span className="text-slate-400">Mover a:</span>
                            <select
                              value={effectiveNonBotFolder}
                              disabled={processing}
                              onChange={e =>
                                setItemFolderOverride(item.orderId, e.target.value as DeliveryFolderChoice)
                              }
                              className="bg-slate-900 border border-white/15 rounded-lg px-2 py-0.5 text-[11px] font-bold text-white focus:outline-none focus:border-cyan-400"
                            >
                              {FOLDER_OPTIONS.map(opt => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.emoji} {opt.short}
                                </option>
                              ))}
                            </select>
                            {item.nonBotFolderOverride && (
                              <span className="text-[10px] text-cyan-300 font-bold">
                                ({effectiveFolderOption?.short})
                              </span>
                            )}
                          </label>
                        ) : null}

                        {item.isShalom && (
                          <span className="inline-flex items-center gap-1 text-amber-300 font-mono font-bold">
                            PIN:
                            <input
                              type="text"
                              maxLength={4}
                              value={item.pickupCode || pickupCode}
                              onChange={e => {
                                item.pickupCode = formatShalomPin(e.target.value);
                                setProgressList([...progressList]);
                              }}
                              className="w-11 px-1 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-300 text-center text-[11px] focus:outline-none"
                            />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {item.phone && (
                          <a
                            href={`https://wa.me/51${item.phone.slice(-9)}?text=${encodeURIComponent(
                              `¡Hola ${item.customerName}! Tu paquete ya fue despachado (${item.agencyName}).\n\n📦 *Guía:* ${
                                item.manualGuideInput || item.guideNumber || item.trackingCode
                              }${item.isShalom ? `\n🔑 *Clave Recojo:* ${item.pickupCode || pickupCode}` : ''}\n\n¡Muchas gracias por tu preferencia! ✨`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-emerald-600/25 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3 h-3" />
                            WA
                          </a>
                        )}

                        {item.sendStatus === 'sending' && (
                          <span className="px-2 py-1 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-500/40 font-bold inline-flex items-center gap-1 animate-pulse">
                            <Smartphone className="w-3 h-3 animate-spin" />
                            Enviando...
                          </span>
                        )}
                        {item.sendStatus === 'completed' && (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Enviado ✓
                          </span>
                        )}
                        {item.sendStatus === 'skipped' && (
                          <span className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/10 font-bold">
                            Sin bot
                          </span>
                        )}
                        {item.sendStatus === 'error' && (
                          <span className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-200 border border-rose-500/40 font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {item.errorMsg || 'Error'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer fijo al alcance del pulgar */}
        <div className="bg-slate-950/95 px-4 sm:px-5 py-3 border-t border-white/10 flex items-center gap-2.5 shrink-0 pb-safe">
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            className="min-h-12 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs sm:text-sm disabled:opacity-50 cursor-pointer shrink-0"
          >
            {completedSummary ? 'Listo / Cerrar' : 'Cancelar'}
          </button>

          {!completedSummary && (
            <button
              type="button"
              onClick={handleConfirmExecution}
              disabled={!canConfirm}
              className={`flex-1 min-h-12 px-4 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer ${
                stats.botSelected > 0
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:brightness-110 text-white shadow-indigo-600/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
              }`}
            >
              {processing || isAuditing ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : stats.botSelected > 0 ? (
                <Send className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span className="truncate">{primaryActionLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal QR Sub-instancia */}
      {showQrModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-purple-500/40 p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-black text-white">Sub Código QR Empresa</h4>
                  <p className="text-[10px] text-slate-400 font-mono">{subInstance}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl flex items-center justify-center shadow-inner min-h-[220px]">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-600">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                  <span className="text-xs font-bold">Generando QR de la Empresa...</span>
                </div>
              ) : qrBase64 ? (
                <img src={qrBase64} alt="Sub-QR WhatsApp" className="w-52 h-52 object-contain" />
              ) : (
                <p className="text-xs text-slate-500">No se pudo cargar el código QR.</p>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Escanea este QR desde el WhatsApp de tu empresa ({senderPhone ? `+${senderPhone}` : 'Línea de Tienda'})
              para enviar mensajes a clientas.
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs hover:opacity-90 cursor-pointer"
            >
              Listo / Cerrar
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
