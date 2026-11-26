import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { useFeedback } from '../../context/FeedbackContext';
import { useShalomAgencies } from '../../hooks/useShalomAgencies';
import {
  ShalomApiService,
  ShalomAuthCredentials,
  ShalomProOrderItem,
  ShalomScannerStatus,
  ShalomTariffResponse,
  ShalomTrackingResponse,
  ShalomTrackingStatusObj,
} from '../../services/shalomApiService';
import { extractShalomDni, extractShalomPhone } from '../../utils/shalomExcelExporter';
import { resolveShalomAgencyDetails } from '../../utils/shalomAgencyResolver';
import {
  Zap,
  Radar,
  Search,
  Calculator,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  FileDown,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Image as ImageIcon,
  Truck,
  Plane,
  UserCheck,
  MapPin,
  Package,
  X,
  ShieldCheck,
  Power,
  Activity,
  ChevronRight,
  KeyRound,
  FileText,
} from 'lucide-react';

type HubSubTab = 'autosugestiones' | 'autogestiones' | 'rastreo' | 'herramientas';
type OrdersFilterKey = 'en_destino' | 'in_transit' | 'pending' | 'en_reparto' | 'delivered';

function formatShortDate(raw?: string | null): string {
  if (!raw) return '—';
  const clean = String(raw).trim();
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+|T)(\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
  const m2 = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;
  return clean.slice(0, 16);
}

function daysSince(raw?: string | null): number | null {
  if (!raw) return null;
  const d = new Date(String(raw).replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function formatCountdown(iso?: string | null): string {
  if (!iso) return 'Cada 3 horas';
  const diff = new Date(iso).getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return 'Próximamente';
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `en ${hrs}h ${remMins}m`;
  return `en ${remMins}m`;
}

export const ShalomProHub: React.FC = () => {
  const { empresaConfig } = useAuth();
  // Seguridad estricta: si la empresa NO tiene habilitado Shalom por API, nunca renderizar ni disparar peticiones
  if (empresaConfig?.shalom_modo !== 'api') {
    return null;
  }
  return <ShalomProHubContent />;
};

const ShalomProHubContent: React.FC = () => {
  const { currentEmpresa, empresaConfig } = useAuth();
  const { pedidos, tallerConfig } = useOrders();
  const { toast, confirm } = useFeedback();
  const { agencies } = useShalomAgencies();

  const empresaId = currentEmpresa?.id || 'empresa-master-comikids';
  const brandName = (currentEmpresa?.nombre || tallerConfig?.nombre_taller || 'ComiKids')
    .replace(/\s*Env[ií]os$/i, '')
    .trim();

  const shalomAuth: ShalomAuthCredentials = useMemo(
    () => ({
      email: empresaConfig?.shalom_email || tallerConfig?.shalom_email || 'milagrosjanetamis@gmail.com',
      password: empresaConfig?.shalom_password || tallerConfig?.shalom_password || '986398Mi$',
    }),
    [empresaConfig?.shalom_email, empresaConfig?.shalom_password, tallerConfig?.shalom_email, tallerConfig?.shalom_password]
  );

  const preferredInstance =
    empresaConfig?.vps_instance_name ||
    currentEmpresa?.sub_instance ||
    tallerConfig?.copilot_sub_instance ||
    'tenant_Comikids';

  const [activeSubTab, setActiveSubTab] = useState<HubSubTab>('autosugestiones');
  const [apiHealth, setApiHealth] = useState<'loading' | 'operational' | 'degraded'>('loading');

  // Estado Escáner 3h
  const [scannerStatus, setScannerStatus] = useState<ShalomScannerStatus | null>(null);
  const [loadingScanner, setLoadingScanner] = useState(false);
  const [runningScanNow, setRunningScanNow] = useState(false);
  const [togglingAutoScan, setTogglingAutoScan] = useState(false);

  // Órdenes en vivo desde Shalom Pro
  const [enDestinoOrders, setEnDestinoOrders] = useState<ShalomProOrderItem[]>([]);
  const [pendingProOrders, setPendingProOrders] = useState<ShalomProOrderItem[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Autogestiones lista filtrada
  const [ordersFilter, setOrdersFilter] = useState<OrdersFilterKey>('en_destino');
  const [liveOrders, setLiveOrders] = useState<ShalomProOrderItem[]>([]);
  const [liveOrdersMeta, setLiveOrdersMeta] = useState<any>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPage, setOrderPage] = useState(1);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [inlineTrackingMap, setInlineTrackingMap] = useState<Record<number, ShalomTrackingResponse | null>>({});
  const [loadingInlineId, setLoadingInlineId] = useState<number | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal de vista previa de foto prueba
  const [proofModal, setProofModal] = useState<{
    open: boolean;
    loading: boolean;
    dataUrl?: string;
    title?: string;
    subtitle?: string;
    orderNumber?: string;
    error?: string;
  }>({ open: false, loading: false });

  // Sub-tab Rastreo en Vivo
  const [trackMode, setTrackMode] = useState<'numero_codigo' | 'ose_id'>('numero_codigo');
  const [trackNumero, setTrackNumero] = useState('');
  const [trackCodigo, setTrackCodigo] = useState('');
  const [trackOseId, setTrackOseId] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<ShalomTrackingResponse | null>(null);
  const [trackingError, setTrackingError] = useState('');
  const [manualNotifyPhone, setManualNotifyPhone] = useState('');
  const [manualNotifyPin, setManualNotifyPin] = useState('0808');
  const [grtLoadingCap, setGrtLoadingCap] = useState<string | null>(null);

  // Sub-tab Cotizador & Herramientas API
  const defaultOriginId = useMemo(() => {
    const resolved = resolveShalomAgencyDetails(tallerConfig?.agencia_shalom_origen || 'AV MEXICO CO');
    return resolved?.terminalId || 4;
  }, [tallerConfig?.agencia_shalom_origen]);

  const [originId, setOriginId] = useState<number>(defaultOriginId);
  const [destSearch, setDestSearch] = useState('');
  const [destAgency, setDestAgency] = useState<{ id: number; name: string; label: string } | null>(null);
  const [tariffAereo, setTariffAereo] = useState(false);
  const [dimWeight, setDimWeight] = useState('0.5');
  const [dimHeight, setDimHeight] = useState('15');
  const [dimLength, setDimLength] = useState('20');
  const [dimWidth, setDimWidth] = useState('12');
  const [tariffLoading, setTariffLoading] = useState(false);
  const [tariffResult, setTariffResult] = useState<ShalomTariffResponse | null>(null);
  const [tariffError, setTariffError] = useState('');

  // Buscador de personas Shalom Pro
  const [personDoc, setPersonDoc] = useState('');
  const [personType, setPersonType] = useState<'DNI' | 'RUC' | 'CE'>('DNI');
  const [personLoading, setPersonLoading] = useState(false);
  const [personResult, setPersonResult] = useState<any>(null);
  const [personError, setPersonError] = useState('');

  // Buscador de agencias API en vivo
  const [liveAgencyQuery, setLiveAgencyQuery] = useState('');
  const [liveAgencyLoading, setLiveAgencyLoading] = useState(false);
  const [liveAgencyResults, setLiveAgencyResults] = useState<any[]>([]);

  // Pedidos locales de Shalom (últimos 14 días) para cruzar teléfonos, claves y avisos
  const localShalomOrders = useMemo(() => {
    const cutoff = Date.now() - 14 * 86400000;
    return pedidos.filter((p) => {
      const isShalom =
        p.metodo_envio_codigo === 'shalom' || Boolean(p.destino_detalle?.toLowerCase().includes('shalom'));
      if (!isShalom) return false;
      const t = new Date(p.updated_at || p.created_at).getTime();
      return isNaN(t) || t >= cutoff;
    });
  }, [pedidos]);

  const localDeliveredCount = useMemo(
    () => localShalomOrders.filter((p) => p.estado_envio === 'entregado' || p.estado_envio === 'en_camino').length,
    [localShalomOrders]
  );

  const unlinkedDeliveredOrders = useMemo(
    () =>
      localShalomOrders
        .filter((p) => p.estado_envio === 'entregado' && !p.shalom_ose_id && !p.shalom_numero_guia)
        .slice(0, 8),
    [localShalomOrders]
  );

  // Emparejar una orden de Shalom Pro con un pedido local de Encomi (para rescatar teléfono, PIN y pedidoId)
  const findLocalMatchForShalomOrder = useCallback(
    (order: ShalomProOrderItem) => {
      const oseStr = String(order.id || '');
      const guiaClean = String(order.guia || '').replace(/\D/g, '');
      const dniClean = String(order.receiver?.document || '').replace(/\D/g, '');

      return (
        pedidos.find((p) => p.shalom_ose_id && String(p.shalom_ose_id) === oseStr) ||
        (guiaClean.length >= 5
          ? pedidos.find((p) => (p.shalom_numero_guia || '').replace(/\D/g, '').endsWith(guiaClean))
          : undefined) ||
        (dniClean.length >= 8
          ? pedidos.find((p) => extractShalomDni(p) === dniClean)
          : undefined)
      );
    },
    [pedidos]
  );

  const loadScannerAndSuggestions = useCallback(async () => {
    setLoadingScanner(true);
    setLoadingSuggestions(true);
    try {
      const [healthRes, scanRes, destRes, pendRes] = await Promise.all([
        ShalomApiService.getApiStatus(),
        ShalomApiService.getScannerStatus(empresaId),
        ShalomApiService.listLiveOrders({ state: 'in_transit', stage: 'en_destino', page: 1, per_page: 40 }, shalomAuth),
        ShalomApiService.listLiveOrders({ state: 'pending', page: 1, per_page: 25 }, shalomAuth),
      ]);

      setApiHealth(healthRes.status === 'degraded' ? 'degraded' : 'operational');
      if (scanRes.success && scanRes.scanner) {
        setScannerStatus(scanRes.scanner);
      }
      if (destRes.success) {
        setEnDestinoOrders(destRes.orders || []);
      }
      if (pendRes.success) {
        setPendingProOrders(pendRes.orders || []);
      }
    } finally {
      setLoadingScanner(false);
      setLoadingSuggestions(false);
    }
  }, [empresaId, shalomAuth]);

  const loadAutogestionesOrders = useCallback(
    async (filter: OrdersFilterKey = ordersFilter, page: number = orderPage) => {
      setLoadingOrders(true);
      try {
        const params: any = { page, per_page: 30 };
        if (filter === 'en_destino') {
          params.state = 'in_transit';
          params.stage = 'en_destino';
        } else if (filter === 'en_reparto') {
          params.state = 'in_transit';
          params.stage = 'en_reparto';
        } else if (filter === 'in_transit') {
          params.state = 'in_transit';
        } else if (filter === 'pending') {
          params.state = 'pending';
        } else if (filter === 'delivered') {
          params.state = 'delivered';
        }

        const res = await ShalomApiService.listLiveOrders(params, shalomAuth);
        if (res.success) {
          setLiveOrders(res.orders || []);
          setLiveOrdersMeta(res.meta || null);
        } else {
          toast(res.error || 'No se pudieron cargar las órdenes de Shalom Pro', 'error');
        }
      } finally {
        setLoadingOrders(false);
      }
    },
    [ordersFilter, orderPage, shalomAuth, toast]
  );

  useEffect(() => {
    loadScannerAndSuggestions();
  }, [loadScannerAndSuggestions]);

  useEffect(() => {
    if (activeSubTab === 'autogestiones') {
      loadAutogestionesOrders(ordersFilter, orderPage);
    }
  }, [activeSubTab, ordersFilter, orderPage, loadAutogestionesOrders]);

  const handleToggleAutoScan = async () => {
    const nextVal = !(scannerStatus?.autoScanEnabled ?? true);
    setTogglingAutoScan(true);
    try {
      const res = await ShalomApiService.setScannerAutoEnabled(empresaId, nextVal);
      if (res.success && res.scanner) {
        setScannerStatus(res.scanner);
        toast(
          nextVal
            ? 'Escáner automático cada 3 horas ACTIVADO'
            : 'Escáner automático pausado',
          nextVal ? 'success' : 'info'
        );
      } else {
        toast(res.error || 'No se pudo cambiar el estado del escáner', 'error');
      }
    } finally {
      setTogglingAutoScan(false);
    }
  };

  const handleRunScanNow = async () => {
    setRunningScanNow(true);
    try {
      const res = await ShalomApiService.runScannerNow(empresaId);
      if (res.success) {
        const rep = res.report;
        toast(
          `Escaneo listo: ${rep?.totalShippedOrdersChecked || 0} revisados, ${rep?.newlyArrivedCount || 0} en agencia, ${rep?.notifiedCount || 0} avisados con foto`,
          'success'
        );
        await loadScannerAndSuggestions();
      } else {
        toast(res.error || 'Error ejecutando el escaneo', 'error');
      }
    } finally {
      setRunningScanNow(false);
    }
  };

  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    toast('Copiado al portapapeles', 'info');
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  };

  const handlePreviewProofImage = async (params: {
    clientName: string;
    clientDni?: string;
    agencyName: string;
    agencyAddress?: string;
    orderNumber: string;
    orderCode?: string;
    pickupCode?: string;
    oseId?: string | number;
    status?: ShalomTrackingStatusObj;
  }) => {
    setProofModal({
      open: true,
      loading: true,
      title: `Constancia Oficial #${params.orderNumber}`,
      subtitle: `${params.clientName} • ${params.agencyName}`,
      orderNumber: params.orderNumber,
    });

    try {
      let liveStatus = params.status;
      if (!liveStatus && (params.oseId || (params.orderNumber && params.orderCode))) {
        const tRes = await ShalomApiService.trackOrder(
          params.orderNumber && params.orderCode
            ? { numero: params.orderNumber, codigo: params.orderCode }
            : { ose_id: params.oseId },
          shalomAuth
        );
        if (tRes.success && tRes.tracking?.status) {
          liveStatus = tRes.tracking.status;
        }
      }

      const imgRes = await ShalomApiService.generateProofImage({
        brandName,
        clientName: params.clientName,
        clientDni: params.clientDni || 'S/DNI',
        agencyName: params.agencyName,
        agencyAddress: params.agencyAddress,
        orderNumber: params.orderNumber,
        orderCode: params.orderCode,
        pickupCode: params.pickupCode || '0808',
        status: liveStatus || {},
      });

      if (imgRes.success && imgRes.dataUrl) {
        setProofModal((prev) => ({ ...prev, loading: false, dataUrl: imgRes.dataUrl }));
      } else {
        setProofModal((prev) => ({ ...prev, loading: false, error: imgRes.error || 'No se pudo generar la foto' }));
      }
    } catch (err: any) {
      setProofModal((prev) => ({ ...prev, loading: false, error: err?.message || 'Error generando constancia' }));
    }
  };

  const handleSendPickupNotification = async (order: ShalomProOrderItem) => {
    const localMatch = findLocalMatchForShalomOrder(order);
    let phone =
      (localMatch ? extractShalomPhone(localMatch) : '') ||
      String(order.receiver?.phone || '').replace(/\D/g, '');

    if (!phone || phone.length < 9) {
      const entered = window.prompt(
        `Ingresa el celular WhatsApp (9 dígitos) de ${order.receiver?.full_name || order.receiver?.name || 'la clienta'} para enviar la prueba de recojo:`
      );
      if (!entered) return;
      phone = entered.replace(/\D/g, '');
    }

    const pin = localMatch?.shalom_clave_recojo || order.pickup_code || '0808';
    const key = String(order.id);
    setSendingOrderId(key);
    try {
      const res = await ShalomApiService.sendManualPickupNotification(
        {
          empresaId,
          brandName,
          pedidoId: localMatch?.id,
          trackingCode: localMatch?.codigo_seguimiento,
          orderNumber: String(order.guia || order.id),
          orderCode: order.codigo,
          oseId: String(order.id),
          clientName: localMatch?.usuario?.nombre_completo || order.receiver?.full_name || order.receiver?.name || 'Cliente',
          clientDni: String(order.receiver?.document || (localMatch ? extractShalomDni(localMatch) : '') || 'S/DNI'),
          clientPhone: phone,
          agencyName: order.destination?.name || localMatch?.destino_detalle || 'Agencia Shalom Destino',
          agencyAddress: order.destination?.address || '',
          pickupCode: pin,
          status: inlineTrackingMap[order.id]?.status,
          preferredInstance,
        },
        shalomAuth
      );

      if (res.success) {
        toast(
          `¡Aviso enviado a ${phone} con ${res.sentWithPhoto ? 'foto de prueba oficial' : 'texto'}!`,
          'success'
        );
        await loadScannerAndSuggestions();
      } else {
        toast(res.error || 'No se pudo enviar el aviso por WhatsApp', 'error');
      }
    } finally {
      setSendingOrderId(null);
    }
  };

  const handleToggleInlineTrack = async (order: ShalomProOrderItem) => {
    if (expandedOrderId === order.id) {
      setExpandedOrderId(null);
      return;
    }
    setExpandedOrderId(order.id);
    if (inlineTrackingMap[order.id]) return;

    setLoadingInlineId(order.id);
    try {
      const res = await ShalomApiService.trackOrder(
        order.guia && order.codigo
          ? { numero: order.guia, codigo: order.codigo }
          : { ose_id: order.id },
        shalomAuth
      );
      setInlineTrackingMap((prev) => ({
        ...prev,
        [order.id]: res.success ? res.tracking || null : null,
      }));
    } finally {
      setLoadingInlineId(null);
    }
  };

  const handleDeleteOrder = async (order: ShalomProOrderItem) => {
    const ok = await confirm({
      title: `¿Anular preguía #${order.guia || order.id}?`,
      message: `Esta acción eliminará la orden de ${order.receiver?.full_name || order.receiver?.name || 'este destinatario'} en Shalom Pro. Solo funciona si el paquete aún no fue recibido en agencia.`,
      confirmLabel: 'Sí, anular en Shalom Pro',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!ok) return;

    setDeletingOrderId(order.id);
    try {
      const res = await ShalomApiService.deleteLiveOrder(order.id, shalomAuth);
      if (res.success) {
        toast(`Orden #${order.guia || order.id} anulada en Shalom Pro`, 'success');
        setPendingProOrders((prev) => prev.filter((o) => o.id !== order.id));
        setLiveOrders((prev) => prev.filter((o) => o.id !== order.id));
      } else {
        toast(res.error || 'Shalom Pro rechazó la anulación', 'error');
      }
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleRunSingleTrack = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTrackingError('');
    setTrackingResult(null);
    setTrackingLoading(true);
    try {
      const params =
        trackMode === 'numero_codigo'
          ? { numero: trackNumero.trim(), codigo: trackCodigo.trim() }
          : { ose_id: trackOseId.trim() };
      const res = await ShalomApiService.trackOrder(params, shalomAuth);
      if (res.success && res.tracking) {
        setTrackingResult(res.tracking);
      } else {
        setTrackingError(res.error || 'No se encontró la orden en Shalom.');
      }
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleOpenGrt = async (oseId: string | number, capId: string) => {
    setGrtLoadingCap(capId);
    try {
      const res = await ShalomApiService.getTrackingGrt(oseId, capId);
      if (res.success && res.enlace) {
        window.open(res.enlace, '_blank', 'noopener,noreferrer');
      } else {
        toast(res.error || 'Enlace GRT no disponible', 'error');
      }
    } finally {
      setGrtLoadingCap(null);
    }
  };

  const handleCalculateTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!destAgency) {
      setTariffError('Selecciona una agencia destino para cotizar.');
      return;
    }
    setTariffError('');
    setTariffResult(null);
    setTariffLoading(true);
    try {
      const w = parseFloat(dimWeight) || 0.5;
      const h = (parseFloat(dimHeight) || 15) / 100;
      const l = (parseFloat(dimLength) || 20) / 100;
      const wd = (parseFloat(dimWidth) || 12) / 100;

      const res = await ShalomApiService.calculateTariff(
        {
          origin_terminal_id: originId,
          destiny_terminal_id: destAgency.id,
          aereo: tariffAereo,
          dimensions: { weight_kg: w, height_m: h, length_m: l, width_m: wd },
        },
        shalomAuth
      );
      if (res.success && res.tariff) {
        setTariffResult(res.tariff);
      } else {
        setTariffError(res.error || 'Shalom no cotizó esta ruta.');
      }
    } finally {
      setTariffLoading(false);
    }
  };

  const handleSearchPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personDoc.trim()) return;
    setPersonError('');
    setPersonResult(null);
    setPersonLoading(true);
    try {
      const res = await ShalomApiService.searchPerson(personDoc, personType, shalomAuth);
      if (res.success && res.person) {
        setPersonResult(res.person);
      } else {
        setPersonError(res.error || 'Persona no encontrada en Shalom Pro.');
      }
    } finally {
      setPersonLoading(false);
    }
  };

  const handleSearchAgenciesLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveAgencyQuery.trim()) return;
    setLiveAgencyLoading(true);
    try {
      const res = await ShalomApiService.searchAgenciesLive(liveAgencyQuery.trim());
      if (res.success) {
        setLiveAgencyResults(res.items || []);
      } else {
        toast(res.error || 'Error buscando agencias', 'error');
      }
    } finally {
      setLiveAgencyLoading(false);
    }
  };

  const filteredDestAgencies = useMemo(() => {
    const q = destSearch.trim().toLowerCase();
    if (!q) return agencies.slice(0, 12);
    return agencies
      .filter((a) => {
        const hay = `${a.nombre || a.name || ''} ${a.departamento || a.department || ''} ${a.provincia || a.province || ''} ${a.distrito || a.district || ''} ${a.direccion || a.address || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 15);
  }, [agencies, destSearch]);

  const filteredLiveOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return liveOrders;
    return liveOrders.filter((o) => {
      const hay = `${o.id} ${o.guia || ''} ${o.codigo || ''} ${o.receiver?.full_name || ''} ${o.receiver?.name || ''} ${o.receiver?.document || ''} ${o.destination?.name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [liveOrders, orderSearch]);

  const notifiedOrderNumbersSet = useMemo(() => {
    const s = new Set<string>();
    (scannerStatus?.recentNotifications || []).forEach((n) => {
      if (n.orderNumber) s.add(n.orderNumber.replace(/\D/g, ''));
      if (n.oseId) s.add(String(n.oseId));
    });
    return s;
  }, [scannerStatus?.recentNotifications]);

  const renderTimeline = (status?: ShalomTrackingStatusObj | null, oseId?: string | number) => {
    if (!status) {
      return (
        <p className="text-xs text-slate-400 italic py-2">
          Sin hitos de rastreo disponibles aún para esta orden.
        </p>
      );
    }

    const steps = [
      { key: 'registrado', label: 'Registrado', data: status.registrado },
      { key: 'origen', label: 'En Origen', data: status.origen },
      { key: 'transito', label: 'En Tránsito', data: status.transito },
      { key: 'destino', label: 'En Agencia Destino', data: status.destino, highlight: Boolean(status.destino?.fecha && !status.entregado?.fecha) },
      { key: 'entregado', label: 'Recogido', data: status.entregado },
    ];

    return (
      <div className="space-y-3">
        {status.demora && (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Shalom reporta demora en tránsito ({formatShortDate(status.demora.fecha)})</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {steps.map((st) => {
            const done = Boolean(st.data?.fecha);
            return (
              <div
                key={st.key}
                className={`p-2.5 rounded-2xl border transition-all ${
                  st.highlight
                    ? 'bg-emerald-500/20 border-emerald-400/60 shadow-md shadow-emerald-500/15'
                    : done
                    ? 'bg-white/6 border-emerald-500/30'
                    : 'bg-slate-950/50 border-white/8 opacity-55'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {done ? (
                    <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${st.highlight ? 'text-emerald-300' : 'text-emerald-400'}`} />
                  ) : (
                    <Clock className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                  )}
                  <span className={`text-[11px] font-black truncate ${st.highlight ? 'text-emerald-200' : done ? 'text-white' : 'text-slate-400'}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-300">
                  {done ? formatShortDate(st.data?.fecha) : 'Pendiente'}
                </p>
              </div>
            );
          })}
        </div>

        {/* Enlaces GRT de cargueros */}
        {oseId && status.transito?.cargueros && status.transito.cargueros.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
              Guías GRT:
            </span>
            {status.transito.cargueros.map((capId) => (
              <button
                key={capId}
                type="button"
                onClick={() => handleOpenGrt(oseId, capId)}
                disabled={grtLoadingCap === capId}
                className="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <FileText className="w-3 h-3" />
                <span>{grtLoadingCap === capId ? 'Abriendo…' : `GRT #${capId}`}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 animate-fadeIn">
      {/* Cabecera Exclusiva Shalom Pro API */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-red-950/85 via-slate-900/95 to-slate-950 border border-red-500/30 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-600/30 shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Shalom Pro • Centro API &amp; Autogestiones
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-200 border border-red-400/40">
                  Exclusivo API
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                    apiHealth === 'operational'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/35'
                      : apiHealth === 'degraded'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  <Activity className="w-3 h-3" />
                  {apiHealth === 'operational' ? 'API Operativa' : apiHealth === 'degraded' ? 'API Lenta' : 'Verificando…'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Autosugestiones inteligentes, escaneo automático cada 3 horas con aviso y foto de prueba, rastreo en vivo, cotizador oficial y autogestión directa.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadScannerAndSuggestions}
            disabled={loadingSuggestions}
            className="self-start sm:self-center px-3.5 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSuggestions ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Sub-navegación Shalom Pro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          {[
            {
              id: 'autosugestiones' as HubSubTab,
              label: 'Autosugestiones & Radar 3h',
              short: 'Radar 3h',
              icon: Sparkles,
              badge: enDestinoOrders.length > 0 ? enDestinoOrders.length : undefined,
            },
            {
              id: 'autogestiones' as HubSubTab,
              label: 'Autogestiones Shalom',
              short: 'Autogestiones',
              icon: Package,
            },
            {
              id: 'rastreo' as HubSubTab,
              label: 'Rastreo en Vivo',
              short: 'Rastreo',
              icon: Search,
            },
            {
              id: 'herramientas' as HubSubTab,
              label: 'Cotizador & API',
              short: 'Cotizador',
              icon: Calculator,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3 py-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-600/30'
                    : 'bg-slate-950/60 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate hidden sm:inline">{tab.label}</span>
                <span className="truncate sm:hidden">{tab.short}</span>
                {tab.badge ? (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                      active ? 'bg-white text-red-700' : 'bg-emerald-500/25 text-emerald-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: AUTOSUGESTIONES & ESCÁNER AUTOMÁTICO CADA 3 HORAS          */}
      {/* ===================================================================== */}
      {activeSubTab === 'autosugestiones' && (
        <div className="space-y-5">
          {/* Tarjeta principal del Escáner Automático cada 3 horas */}
          <div className="rounded-3xl bg-slate-900/80 border border-emerald-500/30 p-5 space-y-4 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center shrink-0">
                  <Radar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-white">
                      Escáner Automático de Recojo (Cada 3 Horas)
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        scannerStatus?.autoScanEnabled !== false
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-700 text-slate-300 border border-white/10'
                      }`}
                    >
                      {scannerStatus?.autoScanEnabled !== false ? 'ACTIVO 24/7' : 'PAUSADO'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Escanea de forma escalonada (micro-lotes de {scannerStatus?.microBatchSize || 5}, nunca todos a la vez) tus pedidos ya <strong className="text-white">Entregados</strong> de los días posteriores. Cuando Shalom confirma llegada a agencia, el bot envía automáticamente por WhatsApp un mensaje simple de agradecimiento + <strong className="text-emerald-300">foto oficial con las pruebas de rastreo</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleAutoScan}
                  disabled={togglingAutoScan}
                  className={`px-3.5 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                    scannerStatus?.autoScanEnabled !== false
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border-emerald-500/40'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/15'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>
                    {togglingAutoScan
                      ? 'Guardando…'
                      : scannerStatus?.autoScanEnabled !== false
                      ? 'Auto-Escaneo ON'
                      : 'Auto-Escaneo OFF'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleRunScanNow}
                  disabled={runningScanNow}
                  className="px-4 py-2.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-4 h-4 ${runningScanNow ? 'animate-spin' : ''}`} />
                  <span>{runningScanNow ? 'Escaneando lote…' : 'Escanear ahora'}</span>
                </button>
              </div>
            </div>

            {/* KPIs rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Monitoreados (14d)</span>
                <strong className="text-xl font-black text-white block mt-0.5">{localDeliveredCount}</strong>
                <span className="text-[10px] text-slate-400">Entregados / en ruta</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-950/35 border border-emerald-500/30">
                <span className="text-[10px] font-bold uppercase text-emerald-300 block">Listos en Agencia</span>
                <strong className="text-xl font-black text-emerald-300 block mt-0.5">{enDestinoOrders.length}</strong>
                <span className="text-[10px] text-emerald-200/75">Esperando recojo hoy</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-cyan-950/35 border border-cyan-500/30">
                <span className="text-[10px] font-bold uppercase text-cyan-300 block">Avisos con Foto</span>
                <strong className="text-xl font-black text-cyan-300 block mt-0.5">
                  {scannerStatus?.recentNotifications?.length || 0}
                </strong>
                <span className="text-[10px] text-cyan-200/75">Enviados por WhatsApp</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Próximo Ciclo</span>
                <strong className="text-sm font-black text-amber-300 block mt-1">
                  {formatCountdown(scannerStatus?.nextScheduledRun)}
                </strong>
                <span className="text-[10px] text-slate-400">
                  {scannerStatus?.lastReport?.timestamp
                    ? `Último: ${formatShortDate(scannerStatus.lastReport.timestamp)}`
                    : 'Escaneo cada 3h'}
                </span>
              </div>
            </div>
          </div>

          {/* AUTOSUGESTIONES INTELIGENTES */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Columna 1: Listos para recoger en Agencia Destino */}
            <div className="rounded-3xl bg-slate-900/75 border border-white/10 p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h4 className="text-sm font-black text-white">
                    Listos para Recoger en Agencia ({enDestinoOrders.length})
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Autosugestión Prioritaria
                </span>
              </div>

              {loadingSuggestions ? (
                <div className="py-10 text-center text-xs text-slate-400">Consultando agencias destino en Shalom Pro…</div>
              ) : enDestinoOrders.length === 0 ? (
                <div className="py-8 text-center rounded-2xl bg-slate-950/50 border border-white/5 text-xs text-slate-400">
                  No hay paquetes esperando recojo en agencia en este momento.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {enDestinoOrders.slice(0, 20).map((ord) => {
                    const local = findLocalMatchForShalomOrder(ord);
                    const days = daysSince(ord.created_at);
                    const alreadySent =
                      notifiedOrderNumbersSet.has(String(ord.guia || '').replace(/\D/g, '')) ||
                      notifiedOrderNumbersSet.has(String(ord.id)) ||
                      Boolean((local?.campos_personalizados as any)?._shalom_pickup_notified_at);

                    const clientName =
                      local?.usuario?.nombre_completo ||
                      ord.receiver?.full_name ||
                      ord.receiver?.name ||
                      'Destinatario';
                    const pin = local?.shalom_clave_recojo || ord.pickup_code || '0808';

                    return (
                      <div
                        key={ord.id}
                        className="p-3.5 rounded-2xl bg-slate-950/80 border border-emerald-500/25 hover:border-emerald-400/50 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-black text-xs text-white truncate">{clientName}</span>
                              {alreadySent ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/35">
                                  ✓ Avisado por Bot
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                                  Pendiente de aviso
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                              <span className="truncate">{ord.destination?.name || 'Agencia destino'}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] font-mono text-slate-400">
                              <span>Orden: <strong className="text-white">{ord.guia || ord.id}</strong></span>
                              {ord.codigo && <span>Cód: <strong className="text-cyan-300">{ord.codigo}</strong></span>}
                              <span>PIN: <strong className="text-emerald-300">{pin}</strong></span>
                              {days !== null && <span>• Hace {days}d</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handlePreviewProofImage({
                                clientName,
                                clientDni: String(ord.receiver?.document || 'S/DNI'),
                                agencyName: ord.destination?.name || 'Agencia Shalom Destino',
                                agencyAddress: ord.destination?.address || '',
                                orderNumber: String(ord.guia || ord.id),
                                orderCode: ord.codigo,
                                pickupCode: pin,
                                oseId: ord.id,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-[11px] font-bold text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-cyan-300" />
                            <span>Ver Prueba</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendPickupNotification(ord)}
                            disabled={sendingOrderId === String(ord.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-[11px] font-black text-emerald-200 inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {sendingOrderId === String(ord.id)
                                ? 'Enviando…'
                                : alreadySent
                                ? 'Reenviar con Foto'
                                : 'Avisar con Foto'}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActiveSubTab('rastreo');
                              if (ord.guia && ord.codigo) {
                                setTrackMode('numero_codigo');
                                setTrackNumero(ord.guia);
                                setTrackCodigo(ord.codigo);
                              } else {
                                setTrackMode('ose_id');
                                setTrackOseId(String(ord.id));
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/12 border border-white/10 text-[11px] font-bold text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            <span>Rastrear</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Columna 2: Preguías pendientes + Alertas de sugerencia */}
            <div className="space-y-4">
              {/* Preguías pendientes sin dejar en agencia */}
              <div className="rounded-3xl bg-slate-900/75 border border-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-black text-white">
                      Preguías sin dejar en Agencia ({pendingProOrders.length})
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Se pueden anular
                  </span>
                </div>

                {pendingProOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center rounded-2xl bg-slate-950/50 border border-white/5">
                    No tienes preguías pendientes acumuladas en Shalom Pro.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {pendingProOrders.slice(0, 10).map((ord) => (
                      <div
                        key={ord.id}
                        className="p-3 rounded-2xl bg-slate-950/75 border border-amber-500/20 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">
                            {ord.receiver?.full_name || ord.receiver?.name || 'Destinatario'}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            #{ord.guia || ord.id} • {ord.destination?.name || 'Destino'} • {formatShortDate(ord.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => ShalomApiService.downloadLabelPdf(ord.id, shalomAuth, `Rotulo_${ord.guia || ord.id}.pdf`)}
                            className="p-1.5 rounded-xl bg-white/8 hover:bg-white/15 text-slate-200 cursor-pointer"
                            title="Descargar Rótulo PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(ord)}
                            disabled={deletingOrderId === ord.id}
                            className="p-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 cursor-pointer disabled:opacity-50"
                            title="Anular preguía en Shalom Pro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sugerencia de pedidos entregados sin OSE/Guía local */}
              {unlinkedDeliveredOrders.length > 0 && (
                <div className="rounded-3xl bg-amber-950/20 border border-amber-500/30 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 text-xs font-black">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {unlinkedDeliveredOrders.length} pedidos en "Entregados" aún no tienen OSE/Guía guardada
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    El escáner cada 3 horas intenta vincularlos automáticamente por DNI contra Shalom Pro. Presiona <strong className="text-white">"Escanear ahora"</strong> para sincronizar sus guías al instante.
                  </p>
                </div>
              )}

              {/* Historial de avisos enviados por el Bot con foto prueba */}
              <div className="rounded-3xl bg-slate-900/75 border border-white/10 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>Últimos Avisos Enviados por el Bot</span>
                  </h4>
                  <span className="text-[10px] text-slate-400">Con constancia visual</span>
                </div>

                {loadingScanner ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Cargando historial…</p>
                ) : !scannerStatus?.recentNotifications?.length ? (
                  <p className="text-xs text-slate-400 py-4 text-center rounded-2xl bg-slate-950/50 border border-white/5">
                    Aún no se han enviado avisos automáticos de recojo. Cuando un paquete llegue a agencia destino, aparecerá aquí con su prueba.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {scannerStatus.recentNotifications.slice(0, 12).map((n) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-2xl bg-slate-950/75 border border-cyan-500/20 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{n.clientName}</span>
                            {n.sentWithPhoto && (
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/20 text-emerald-300">
                                Foto ✓
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            Orden #{n.orderNumber} • {n.agencyName} • {formatShortDate(n.notifiedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handlePreviewProofImage({
                              clientName: n.clientName,
                              clientDni: n.clientDni,
                              agencyName: n.agencyName,
                              orderNumber: n.orderNumber,
                              orderCode: n.orderCode,
                              pickupCode: n.pickupCode,
                              oseId: n.oseId,
                              status: n.status,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-[10px] font-bold text-cyan-200 shrink-0 cursor-pointer"
                        >
                          Ver foto
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: AUTOGESTIONES SHALOM PRO (ÓRDENES EN VIVO)                 */}
      {/* ===================================================================== */}
      {activeSubTab === 'autogestiones' && (
        <div className="space-y-4">
          {/* Accesos rápidos a Autogestión Shalom Pro */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">
                  Autogestión de Guías Shalom Pro en Vivo
                </h3>
                <p className="text-xs text-slate-400">
                  Gestiona preguías, descarga rótulos/comprobantes POS, revisa hitos en vivo, anula borradores o envía pruebas de recojo.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://pro.shalom.pe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/35 border border-red-500/40 text-red-200 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Shalom Pro Web</span>
                </a>
                <a
                  href="https://rastrea.shalom.pe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Rastrea Shalom</span>
                </a>
              </div>
            </div>

            {/* Filtros por etapa */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'en_destino' as OrdersFilterKey, label: 'Listos en Agencia' },
                { id: 'in_transit' as OrdersFilterKey, label: 'En Tránsito' },
                { id: 'pending' as OrdersFilterKey, label: 'Preguías Pendientes' },
                { id: 'en_reparto' as OrdersFilterKey, label: 'En Reparto' },
                { id: 'delivered' as OrdersFilterKey, label: 'Ya Recogidos' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setOrdersFilter(f.id);
                    setOrderPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    ordersFilter === f.id
                      ? 'bg-red-600 text-white border-red-400'
                      : 'bg-slate-950/70 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Filtrar por guía, DNI, nombre o agencia…"
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Lista de órdenes */}
          {loadingOrders ? (
            <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-red-400" />
              <span>Consultando órdenes en tiempo real desde Shalom Pro…</span>
            </div>
          ) : filteredLiveOrders.length === 0 ? (
            <div className="py-14 text-center rounded-3xl bg-slate-900/60 border border-white/10 text-xs text-slate-400">
              No se encontraron órdenes en esta categoría.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredLiveOrders.map((ord) => {
                const isExpanded = expandedOrderId === ord.id;
                const local = findLocalMatchForShalomOrder(ord);
                const clientName =
                  local?.usuario?.nombre_completo || ord.receiver?.full_name || ord.receiver?.name || 'Destinatario';
                const pin = local?.shalom_clave_recojo || ord.pickup_code || '0808';

                return (
                  <div
                    key={ord.id}
                    className="rounded-2xl bg-slate-900/80 border border-white/10 hover:border-white/20 p-4 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-red-500/20 text-red-200 border border-red-500/35">
                            {ord.serie ? `${ord.serie}-` : ''}
                            {ord.guia || ord.id}
                          </span>
                          {ord.codigo && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(`${ord.guia || ord.id} ${ord.codigo}`, `cp-${ord.id}`)}
                              className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 inline-flex items-center gap-1 cursor-pointer"
                              title="Copiar orden y código"
                            >
                              <span>Cód: {ord.codigo}</span>
                              {copiedKey === `cp-${ord.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          )}
                          <span className="text-xs font-black text-white truncate">{clientName}</span>
                          {ord.receiver?.document && (
                            <span className="text-[11px] font-mono text-slate-400">DNI {ord.receiver.document}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1 text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-rose-400" />
                            {ord.destination?.name || 'Destino'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <KeyRound className="w-3 h-3 text-emerald-400" />
                            Clave: <strong className="text-emerald-300 font-mono">{pin}</strong>
                          </span>
                          <span>Fecha: {formatShortDate(ord.created_at)}</span>
                        </div>
                      </div>

                      {/* Acciones de autogestión */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleInlineTrack(ord)}
                          className="px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Radar className="w-3.5 h-3.5" />
                          <span>{isExpanded ? 'Ocultar' : 'Estado Vivo'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => ShalomApiService.downloadVoucherPdf(ord.id, shalomAuth, `Voucher_${ord.guia || ord.id}.pdf`)}
                          className="px-2.5 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="Descargar Comprobante / Ticket POS"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Voucher</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => ShalomApiService.downloadLabelPdf(ord.id, shalomAuth, `Rotulo_${ord.guia || ord.id}.pdf`)}
                          className="px-2.5 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/15 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          title="Descargar Rótulo Oficial PDF"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Rótulo</span>
                        </button>

                        {ordersFilter !== 'pending' && ordersFilter !== 'delivered' && (
                          <button
                            type="button"
                            onClick={() => handleSendPickupNotification(ord)}
                            disabled={sendingOrderId === String(ord.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 text-[11px] font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{sendingOrderId === String(ord.id) ? 'Enviando…' : 'Avisar + Foto'}</span>
                          </button>
                        )}

                        {ordersFilter === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(ord)}
                            disabled={deletingOrderId === ord.id}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingOrderId === ord.id ? 'Anulando…' : 'Anular'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Panel expandible de tracking en vivo */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-white/10 space-y-3">
                        {loadingInlineId === ord.id ? (
                          <div className="text-xs text-slate-400 flex items-center gap-2 py-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            <span>Consultando hitos oficiales en Shalom…</span>
                          </div>
                        ) : (
                          <>
                            {renderTimeline(inlineTrackingMap[ord.id]?.status, ord.id)}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handlePreviewProofImage({
                                    clientName,
                                    clientDni: String(ord.receiver?.document || 'S/DNI'),
                                    agencyName: ord.destination?.name || 'Agencia Shalom Destino',
                                    agencyAddress: ord.destination?.address || '',
                                    orderNumber: String(ord.guia || ord.id),
                                    orderCode: ord.codigo,
                                    pickupCode: pin,
                                    oseId: ord.id,
                                    status: inlineTrackingMap[ord.id]?.status,
                                  })
                                }
                                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-cyan-300" />
                                <span>Generar Foto de Prueba Oficial</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Paginación */}
              {liveOrdersMeta?.last_page > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={orderPage <= 1}
                    onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-slate-400">
                    Página {orderPage} de {liveOrdersMeta.last_page}
                  </span>
                  <button
                    type="button"
                    disabled={orderPage >= liveOrdersMeta.last_page}
                    onClick={() => setOrderPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: RASTREO EN VIVO INDIVIDUAL                                 */}
      {/* ===================================================================== */}
      {activeSubTab === 'rastreo' && (
        <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base font-black text-white">Rastreo Oficial Shalom en Tiempo Real</h3>
            <p className="text-xs text-slate-400">
              Consulta cualquier guía con N° de Orden + Código (4 caracteres) o directamente por OSE ID, descarga su foto de prueba oficial y envíala por WhatsApp.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTrackMode('numero_codigo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                trackMode === 'numero_codigo'
                  ? 'bg-red-600 text-white border-red-400'
                  : 'bg-slate-950 text-slate-300 border-white/10'
              }`}
            >
              Por N° de Orden + Código
            </button>
            <button
              type="button"
              onClick={() => setTrackMode('ose_id')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                trackMode === 'ose_id'
                  ? 'bg-red-600 text-white border-red-400'
                  : 'bg-slate-950 text-slate-300 border-white/10'
              }`}
            >
              Por OSE ID
            </button>
          </div>

          <form onSubmit={handleRunSingleTrack} className="flex flex-col sm:flex-row gap-2.5">
            {trackMode === 'numero_codigo' ? (
              <>
                <input
                  type="text"
                  required
                  value={trackNumero}
                  onChange={(e) => setTrackNumero(e.target.value)}
                  placeholder="N° de Orden (ej: 105294873)"
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-red-500"
                />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={trackCodigo}
                  onChange={(e) => setTrackCodigo(e.target.value.toUpperCase())}
                  placeholder="Código (ej: N3NW)"
                  className="w-full sm:w-44 px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/15 text-sm font-mono uppercase text-cyan-300 focus:outline-none focus:border-red-500"
                />
              </>
            ) : (
              <input
                type="text"
                required
                value={trackOseId}
                onChange={(e) => setTrackOseId(e.target.value)}
                placeholder="OSE ID de Shalom (ej: 108766277)"
                className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/15 text-sm font-mono text-white focus:outline-none focus:border-red-500"
              />
            )}

            <button
              type="submit"
              disabled={trackingLoading}
              className="px-5 py-2.5 rounded-2xl bg-linear-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{trackingLoading ? 'Rastreando…' : 'Rastrear Ahora'}</span>
            </button>
          </form>

          {trackingError && (
            <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs font-bold">
              {trackingError}
            </div>
          )}

          {trackingResult && (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/80 border border-white/15 space-y-4">
              {trackingResult.order && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Destinatario</span>
                    <strong className="text-white block mt-0.5">
                      {trackingResult.order.destinatario?.nombre || 'Cliente'}
                    </strong>
                    <span className="text-[11px] font-mono text-slate-400">
                      Doc: {trackingResult.order.destinatario?.documento || '—'}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Ruta</span>
                    <strong className="text-emerald-300 block mt-0.5 truncate">
                      {trackingResult.order.destino?.nombre || 'Destino'}
                    </strong>
                    <span className="text-[11px] text-slate-400 truncate block">
                      Desde: {trackingResult.order.origen?.nombre || 'Origen'}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Pago &amp; Paquete</span>
                    <strong className="text-cyan-300 block mt-0.5">
                      S/ {trackingResult.order.monto || '—'} • {trackingResult.order.tipo_pago || 'Estándar'}
                    </strong>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {trackingResult.order.contenido || 'Encomienda'}
                    </span>
                  </div>
                </div>
              )}

              {renderTimeline(
                trackingResult.status,
                trackingResult.order?.ose_id || (trackMode === 'ose_id' ? trackOseId : undefined)
              )}

              {/* Generar foto prueba o enviar por WhatsApp */}
              <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-end gap-2.5">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      WhatsApp Cliente (9 dígitos)
                    </label>
                    <input
                      type="tel"
                      value={manualNotifyPhone}
                      onChange={(e) => setManualNotifyPhone(e.target.value)}
                      placeholder="987654321"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Clave de recojo (PIN)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={manualNotifyPin}
                      onChange={(e) => setManualNotifyPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="0808"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-emerald-300"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handlePreviewProofImage({
                        clientName: trackingResult.order?.destinatario?.nombre || 'Cliente',
                        clientDni: trackingResult.order?.destinatario?.documento || 'S/DNI',
                        agencyName: trackingResult.order?.destino?.nombre || 'Agencia Shalom Destino',
                        orderNumber: trackingResult.order?.numero_orden || trackNumero || trackOseId,
                        orderCode: trackingResult.order?.codigo_orden || trackCodigo,
                        pickupCode: manualNotifyPin || '0808',
                        status: trackingResult.status,
                      })
                    }
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-cyan-300" />
                    <span>Ver Foto Prueba</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!manualNotifyPhone.trim()) {
                        toast('Ingresa el número de WhatsApp del cliente', 'error');
                        return;
                      }
                      setSendingOrderId('manual-track');
                      try {
                        const res = await ShalomApiService.sendManualPickupNotification(
                          {
                            empresaId,
                            brandName,
                            orderNumber: trackingResult.order?.numero_orden || trackNumero || trackOseId,
                            orderCode: trackingResult.order?.codigo_orden || trackCodigo,
                            oseId: trackingResult.order?.ose_id ? String(trackingResult.order.ose_id) : trackOseId || undefined,
                            clientName: trackingResult.order?.destinatario?.nombre || 'Cliente',
                            clientDni: trackingResult.order?.destinatario?.documento || 'S/DNI',
                            clientPhone: manualNotifyPhone,
                            agencyName: trackingResult.order?.destino?.nombre || 'Agencia Shalom Destino',
                            pickupCode: manualNotifyPin || '0808',
                            status: trackingResult.status,
                            preferredInstance,
                          },
                          shalomAuth
                        );
                        if (res.success) {
                          toast('¡Prueba de recojo enviada por WhatsApp!', 'success');
                        } else {
                          toast(res.error || 'No se pudo enviar', 'error');
                        }
                      } finally {
                        setSendingOrderId(null);
                      }
                    }}
                    disabled={sendingOrderId === 'manual-track'}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{sendingOrderId === 'manual-track' ? 'Enviando…' : 'Enviar por WhatsApp'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 4: COTIZADOR OFICIAL + PERSONAS + AGENCIAS EN VIVO            */}
      {/* ===================================================================== */}
      {activeSubTab === 'herramientas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Cotizador Oficial de Tarifas */}
          <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Cotizador Oficial de Tarifas</h3>
                <p className="text-xs text-slate-400">Precios reales en soles (PEN) directo desde Shalom Pro</p>
              </div>
            </div>

            <form onSubmit={handleCalculateTariff} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Terminal Origen (ID)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={originId}
                    onChange={(e) => setOriginId(Number(e.target.value))}
                    className="w-28 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 font-mono text-cyan-300"
                  />
                  <span className="text-[11px] text-slate-400 truncate">
                    Por defecto: {tallerConfig?.agencia_shalom_origen || 'AV MEXICO CO'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Agencia Destino</label>
                <input
                  type="text"
                  value={destSearch}
                  onChange={(e) => {
                    setDestSearch(e.target.value);
                    setDestAgency(null);
                  }}
                  placeholder="Escribe ciudad, distrito o agencia (ej: Arequipa, Trujillo, Piura)…"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white focus:outline-none focus:border-emerald-500"
                />
                {destAgency ? (
                  <div className="mt-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-200 flex items-center justify-between">
                    <span className="font-bold truncate">✓ {destAgency.label} (ID #{destAgency.id})</span>
                    <button
                      type="button"
                      onClick={() => setDestAgency(null)}
                      className="text-emerald-300 hover:text-white ml-2 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : destSearch.trim().length >= 2 ? (
                  <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl bg-slate-950 border border-white/10 divide-y divide-white/5">
                    {filteredDestAgencies.map((ag) => {
                      const label = `${ag.departamento || ag.department || ''} / ${ag.distrito || ag.district || ''} — ${ag.nombre || ag.name || ''}`;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            setDestAgency({ id: Number(ag.id), name: ag.nombre || ag.name || '', label });
                            setDestSearch(ag.nombre || ag.name || '');
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-white/10 text-slate-200 flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">#{ag.id}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {/* Terrestre vs Aéreo */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTariffAereo(false)}
                  className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    !tariffAereo
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : 'bg-slate-950 border-white/10 text-slate-400'
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span>Terrestre</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTariffAereo(true)}
                  className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                    tariffAereo
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-950 border-white/10 text-slate-400'
                  }`}
                >
                  <Plane className="w-4 h-4" />
                  <span>Aéreo</span>
                </button>
              </div>

              {/* Dimensiones opcionales para Otra Medida */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Peso (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dimWeight}
                    onChange={(e) => setDimWeight(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Alto (cm)</label>
                  <input
                    type="number"
                    value={dimHeight}
                    onChange={(e) => setDimHeight(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Largo (cm)</label>
                  <input
                    type="number"
                    value={dimLength}
                    onChange={(e) => setDimLength(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Ancho (cm)</label>
                  <input
                    type="number"
                    value={dimWidth}
                    onChange={(e) => setDimWidth(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={tariffLoading || !destAgency}
                className="w-full py-2.5 rounded-2xl bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-black text-xs cursor-pointer disabled:opacity-50"
              >
                {tariffLoading ? 'Cotizando en Shalom Pro…' : 'Calcular Tarifa Oficial'}
              </button>
            </form>

            {tariffError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs font-bold">
                {tariffError}
              </div>
            )}

            {tariffResult?.breakdown && (
              <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-300">
                    Tarifario Oficial ({tariffResult.aereo ? 'Aéreo ✈️' : 'Terrestre 🚚'})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const b = tariffResult.breakdown!;
                      const txt = `📦 *Cotización Shalom (${destAgency?.name})*\n• Sobre: S/ ${Number(b.sobre || 0).toFixed(2)}\n• Caja XXS: S/ ${Number(b.caja_paquete_xxs || 0).toFixed(2)}\n• Caja XS: S/ ${Number(b.caja_paquete_xs || 0).toFixed(2)}\n• Caja S: S/ ${Number(b.caja_paquete_s || 0).toFixed(2)}\n• Caja M: S/ ${Number(b.caja_paquete_m || 0).toFixed(2)}\n• Caja L: S/ ${Number(b.caja_paquete_l || 0).toFixed(2)}`;
                      handleCopyText(txt, 'tariff-copy');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copiar para WhatsApp</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { k: 'sobre', label: 'Sobre A4' },
                    { k: 'caja_paquete_xxs', label: 'Paquete XXS' },
                    { k: 'caja_paquete_xs', label: 'Paquete XS' },
                    { k: 'caja_paquete_s', label: 'Paquete S' },
                    { k: 'caja_paquete_m', label: 'Paquete M' },
                    { k: 'caja_paquete_l', label: 'Paquete L' },
                    { k: 'otra_medida', label: 'Otra Medida' },
                  ].map((row) => {
                    const price = tariffResult.breakdown?.[row.k];
                    if (price === undefined || price === null) return null;
                    return (
                      <div key={row.k} className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                        <span className="text-[10px] text-slate-400 block">{row.label}</span>
                        <strong className="text-sm font-black text-white">S/ {Number(price).toFixed(2)}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Derecha: Verificador de Personas + Buscador de Agencias API */}
          <div className="space-y-5">
            {/* Buscador de personas en Shalom Pro */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Verificador de Cliente en Shalom Pro</h3>
                  <p className="text-xs text-slate-400">Consulta si un DNI, RUC o CE ya está registrado en Shalom</p>
                </div>
              </div>

              <form onSubmit={handleSearchPerson} className="flex flex-wrap gap-2">
                <select
                  value={personType}
                  onChange={(e) => setPersonType(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs font-bold text-white"
                >
                  <option value="DNI">DNI</option>
                  <option value="RUC">RUC</option>
                  <option value="CE">CE</option>
                </select>
                <input
                  type="text"
                  value={personDoc}
                  onChange={(e) => setPersonDoc(e.target.value)}
                  placeholder="Ej: 70123456"
                  className="flex-1 min-w-[140px] px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs font-mono text-white"
                />
                <button
                  type="submit"
                  disabled={personLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {personLoading ? 'Buscando…' : 'Verificar'}
                </button>
              </form>

              {personError && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl">
                  {personError}
                </p>
              )}

              {personResult && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/35 border border-indigo-500/35 text-xs space-y-1">
                  <p className="font-black text-white text-sm">
                    {personResult.full_name || `${personResult.name || ''} ${personResult.last_name || ''}`}
                  </p>
                  <p className="text-slate-300 font-mono">
                    {personResult.document_type}: {personResult.document} • ID Shalom: #{personResult.id}
                  </p>
                  {personResult.phone ? (
                    <p className="text-emerald-300 font-mono">Teléfono registrado: {personResult.phone}</p>
                  ) : null}
                </div>
              )}
            </div>

            {/* Buscador de Agencias API en Vivo */}
            <div className="rounded-3xl bg-slate-900/80 border border-white/10 p-5 space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Buscador Oficial de Agencias API</h3>
                  <p className="text-xs text-slate-400">Consulta directa al catálogo en vivo de Shalom Perú</p>
                </div>
              </div>

              <form onSubmit={handleSearchAgenciesLive} className="flex gap-2">
                <input
                  type="text"
                  value={liveAgencyQuery}
                  onChange={(e) => setLiveAgencyQuery(e.target.value)}
                  placeholder="Buscar ciudad, distrito o avenida…"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={liveAgencyLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {liveAgencyLoading ? 'Buscando…' : 'Buscar'}
                </button>
              </form>

              {liveAgencyResults.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {liveAgencyResults.map((a: any) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs space-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-white truncate">{a.nombre || a.name}</strong>
                        <span className="text-[10px] font-mono text-cyan-300 shrink-0">ID #{a.id}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{a.direccion || a.address}</p>
                      <p className="text-[10px] text-slate-500">
                        {[a.departamento, a.provincia, a.distrito].filter(Boolean).join(' / ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL DE VISTA PREVIA DE FOTO PRUEBA OFICIAL                          */}
      {/* ===================================================================== */}
      {proofModal.open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-lg max-h-[92vh] rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-2xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">{proofModal.title || 'Constancia de Rastreo'}</h3>
                  <p className="text-[11px] text-slate-400 truncate">{proofModal.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProofModal({ open: false, loading: false })}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-slate-950/70">
                {proofModal.loading ? (
                  <div className="py-16 flex flex-col items-center gap-3 text-xs text-slate-300">
                    <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
                    <span>Generando foto prueba oficial con QR…</span>
                  </div>
                ) : proofModal.error ? (
                  <p className="text-xs text-rose-300 py-8">{proofModal.error}</p>
                ) : proofModal.dataUrl ? (
                  <img
                    src={proofModal.dataUrl}
                    alt="Constancia oficial Shalom"
                    className="w-full h-auto rounded-2xl border border-white/15 shadow-2xl"
                  />
                ) : null}
              </div>

              {proofModal.dataUrl && (
                <div className="p-3.5 border-t border-white/10 flex justify-end gap-2 bg-slate-900">
                  <a
                    href={proofModal.dataUrl}
                    download={`Prueba_Recojo_Shalom_${proofModal.orderNumber || 'orden'}.png`}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs inline-flex items-center gap-1.5"
                  >
                    <FileDown className="w-4 h-4" />
                    <span>Descargar Foto</span>
                  </a>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
