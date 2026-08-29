import React, { useState, useEffect } from 'react';
import {
  Package,
  Zap,
  Sparkles,
  ShieldCheck,
  Send,
  MessageCircle,
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  TrendingUp,
  Cpu,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Layers,
  FileCheck2,
  Users,
  Smartphone,
  Flame,
  Award,
  Star,
  ExternalLink,
  Store,
  PhoneCall
} from 'lucide-react';

const CONTACT_PHONE = "+51 963097546";
const CONTACT_PHONE_CLEAN = "51963097546";

export const EncomiFunnelLanding: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [packagesPerWeek, setPackagesPerWeek] = useState(120);
  const [autoplay, setAutoplay] = useState(true);

  const slides = [
    {
      id: 'shalom-api',
      badge: 'INTEGRACIÓN OFICIAL SHALOM PRO & OLVA',
      title: 'Envíos Masivos y Generación de Guías PDF con 1 Solo Clic',
      subtitle: 'Elimina las colas y los errores de digitación manual. Conexión directa a la API de Shalom Pro y generación de comprobantes con clave de recojo PIN 0808.',
      icon: Truck,
      gradient: 'from-pink-500 via-purple-600 to-indigo-600',
      shadowColor: 'rgba(236,72,153,0.3)',
      features: [
        'Exportación e importación con plantilla oficial Excel Shalom empaquetada',
        'Generación de Guías Oficiales PDF auténticas extraídas vía API',
        'Validación estricta de DNI, teléfono y jerarquía de 546 agencias',
        'Asignación automática de clave de recojo PIN'
      ],
      metrics: [
        { label: 'Tiempo por Guía', value: '< 2 seg', detail: 'vs 4 min manual' },
        { label: 'Precisión de Datos', value: '100%', detail: '0 errores de digitación' }
      ]
    },
    {
      id: 'whatsapp-bot',
      badge: 'AUTOMATIZACIÓN WHATSAPP & COPILOTO IA',
      title: 'Notificaciones Instantáneas y Envío de Comprobantes por WhatsApp',
      subtitle: 'Tus clientas reciben su comprobante rotulado, fecha estimada y PDF oficial directamente en su chat sin que tengas que escribir uno por uno.',
      icon: MessageCircle,
      gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
      shadowColor: 'rgba(16,185,129,0.3)',
      features: [
        'Vinculación de Sub-QR WhatsApp multi-dispositivo vía Evolution API',
        'Envío automático del comprobante con enlace de seguimiento en vivo',
        'Copiloto de IA que responde consultas de estado y tiempos 24/7',
        'Mensajes organizados, compactos y con identidad de tu marca'
      ],
      metrics: [
        { label: 'Apertura de Mensajes', value: '98.5%', detail: 'en menos de 5 min' },
        { label: 'Consultas Ahorradas', value: '-85%', detail: 'respuestas automáticas' }
      ]
    },
    {
      id: 'smart-map',
      badge: 'GEOLOCALIZACIÓN GPS & MAPA VISION PRO',
      title: 'Buscador Inteligente de 546 Agencias Shalom en Todo el Perú',
      subtitle: 'Tus clientas encuentran la agencia más cercana en segundos mediante GPS o mapa interactivo 3D con horarios y distancias en metros.',
      icon: MapPin,
      gradient: 'from-cyan-500 via-blue-600 to-purple-600',
      shadowColor: 'rgba(6,182,212,0.3)',
      features: [
        'Diccionario canónico oficial con 546 agencias activas en los 24 departamentos',
        'Detección por GPS de las 5 sedes más cercanas con distancia Haversine',
        'Mapa interactivo estilo Apple Vision Pro con pines personalizados',
        'Resolución jerárquica exacta para evitar confusiones de nombres'
      ],
      metrics: [
        { label: 'Agencias Mapeadas', value: '546', detail: 'Cobertura nacional' },
        { label: 'Selección Promedio', value: '10 seg', detail: 'por parte de la clienta' }
      ]
    },
    {
      id: 'workshop-queue',
      badge: 'TALLER TEXTIL & CONTROL DE BORDADOS',
      title: 'Control de Producción en Vivo, Cola de Bordados & Gamificación',
      subtitle: 'Monitorea el avance de cada prenda en tiempo real: desde alistamiento en mesa de corte hasta entrega en agencia con sistema de XP para tu equipo.',
      icon: Layers,
      gradient: 'from-amber-500 via-orange-600 to-pink-600',
      shadowColor: 'rgba(245,158,11,0.3)',
      features: [
        'Tablero Kanban sincronizado en tiempo real con Supabase',
        'Cola de bordados priorizada por fecha límite y estado de urgencia',
        'Sistema de puntos de experiencia (XP), niveles y logros para colaboradores',
        'Alertas audibles para nuevas órdenes y pagos vía Yape'
      ],
      metrics: [
        { label: 'Eficiencia de Taller', value: '+45%', detail: 'menor tiempo ocioso' },
        { label: 'Entregas a Tiempo', value: '99.8%', detail: 'cumplimiento de metas' }
      ]
    },
    {
      id: 'client-portal',
      badge: 'EXPERIENCIA DE CLIENTE DE ÉLITE',
      title: 'Portal de Envíos Orgánico y Rastreador en Vivo sin Fricción',
      subtitle: 'Ofrece a tus clientas una experiencia premium donde pueden registrar sus datos en 2 clics, ver comprobantes digitales y consultar con IA.',
      icon: Sparkles,
      gradient: 'from-violet-500 via-purple-600 to-pink-600',
      shadowColor: 'rgba(139,92,246,0.3)',
      features: [
        'Formulario orgánico con auto-guardado en memoria (no pierde datos)',
        'Rastreador en vivo estilo Uber para pedidos locales y motorizados',
        'Comprobante digital estándar con código QR y verificación oficial',
        'Diseño 100% optimizado para celulares de cualquier gama'
      ],
      metrics: [
        { label: 'Satisfacción Clientas', value: '5/5 ⭐', detail: 'experiencia wow' },
        { label: 'Re-compra de Clientes', value: '+30%', detail: 'por confianza y rapidez' }
      ]
    }
  ];

  // Autoplay del carrusel
  useEffect(() => {
    if (!autoplay) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [autoplay, slides.length]);

  // Cálculos de ROI
  const hoursSavedPerMonth = Math.round((packagesPerWeek * 4 * 3.5) / 60); // 3.5 min ahorrados por paquete
  const moneySavedPerMonth = Math.round(hoursSavedPerMonth * 25); // S/ 25 valor hora operativa

  const handleWhatsAppContact = (customMessage?: string) => {
    const text = customMessage || `¡Hola! Deseo implementar Encomi Envíos en mi taller / negocio. Vi el sistema operativo y quiero multiplicar x10 la velocidad de mis despachos 🚀✨`;
    const url = `https://api.whatsapp.com/send?phone=${CONTACT_PHONE_CLEAN}&text=${encodeURIComponent(text)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-pink-500 selection:text-white pb-20 relative overflow-hidden">
      
      {/* Luces de Fondo Futuristas */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-pink-600/20 via-purple-600/20 to-cyan-500/20 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 -left-40 w-[500px] h-[500px] bg-cyan-600/15 rounded-full blur-[130px]" />
        <div className="absolute bottom-20 -right-40 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[150px]" />
      </div>

      {/* Barra de Navegación Superior */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/25">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Encomi Envíos OS
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-pink-500/20 text-pink-300 border border-pink-500/40">
                PRO 2026
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Ecosistema Operativo de Despacho & Talleres
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>API Shalom & WhatsApp Activos</span>
          </div>

          <button
            onClick={() => handleWhatsAppContact('¡Hola! Deseo más información sobre Encomi Envíos para implementarlo en mi marca 🚀')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-950/40 transition-all active:scale-98 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>Contactar Asesor</span>
          </button>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 space-y-16 sm:space-y-24">
        
        {/* HERO SECTION */}
        <section className="text-center space-y-6 max-w-4xl mx-auto animate-fadeIn">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-cyan-500/15 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-wider shadow-inner">
            <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
            <span>El Sistema de Despachos Textil & Encomiendas #1 del Perú</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Multiplica <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">x10 la Velocidad</span> de tus Despachos y Envíos Masivos
          </h1>

          <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Automatiza <strong>Shalom Pro, Olva y Motorizados</strong>. Genera guías PDF con 1 clic, envía comprobantes instantáneos con clave PIN por WhatsApp y controla tu taller en tiempo real sin perder un solo paquete.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              onClick={() => handleWhatsAppContact('¡Hola! Quiero cotizar la implementación de Encomi Envíos en mi empresa 📦✨')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-2xl shadow-purple-950/60 transition-all active:scale-98 cursor-pointer group"
            >
              <Zap className="w-5 h-5 fill-current text-yellow-300 group-hover:scale-110 transition-transform" />
              <span>Implementar en mi Negocio</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <a
              href="/"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/15 text-sm sm:text-base font-bold flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
            >
              <Store className="w-4 h-4 text-cyan-400" />
              <span>Probar Portal de Cliente</span>
            </a>
          </div>

          {/* Micro-Estadísticas Clave */}
          <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md space-y-1">
              <span className="font-black text-2xl sm:text-3xl text-pink-400 font-mono block">10x</span>
              <span className="text-[11px] sm:text-xs text-slate-300 font-semibold">Más Rápido al Despachar</span>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md space-y-1">
              <span className="font-black text-2xl sm:text-3xl text-cyan-400 font-mono block">100%</span>
              <span className="text-[11px] sm:text-xs text-slate-300 font-semibold">Guías PDF Automatizadas</span>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md space-y-1">
              <span className="font-black text-2xl sm:text-3xl text-emerald-400 font-mono block">546</span>
              <span className="text-[11px] sm:text-xs text-slate-300 font-semibold">Agencias Shalom Mapeadas</span>
            </div>
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md space-y-1">
              <span className="font-black text-2xl sm:text-3xl text-yellow-400 font-mono block">0%</span>
              <span className="text-[11px] sm:text-xs text-slate-300 font-semibold">Paquetes Perdidos</span>
            </div>
          </div>
        </section>

        {/* CARRUSEL INTERACTIVO 2026 - LOS 5 PILARES DE ENCOMI OS */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">
              TECNOLOGÍA DE VANGUARDIA
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Todo lo que Necesitas para Dominar tu Logística
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
              Diseñado específicamente para marcas de ropa, talleres de confección, bordadurías y comercios e-commerce en Perú.
            </p>
          </div>

          {/* Selector de Pestañas del Carrusel */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {slides.map((s, idx) => {
              const Icon = s.icon;
              const isActive = currentSlide === idx;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setCurrentSlide(idx);
                    setAutoplay(false);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-950 shadow-lg shadow-white/20 scale-105'
                      : 'bg-slate-900/90 text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-pink-600' : 'text-slate-400'}`} />
                  <span>Pilar {idx + 1}</span>
                </button>
              );
            })}
          </div>

          {/* Diapositiva Activa del Carrusel */}
          {(() => {
            const active = slides[currentSlide];
            const ActiveIcon = active.icon;
            return (
              <div
                className="relative rounded-3xl bg-slate-900/90 border border-white/15 p-6 sm:p-10 shadow-2xl overflow-hidden transition-all duration-500"
                style={{ boxShadow: `0 20px 50px -10px ${active.shadowColor}` }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  
                  {/* Columna Izquierda: Información */}
                  <div className="lg:col-span-7 space-y-5 text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold text-white uppercase tracking-wider">
                      <ActiveIcon className="w-3.5 h-3.5 text-pink-400" />
                      <span>{active.badge}</span>
                    </div>

                    <h3 className="text-xl sm:text-3xl font-black text-white leading-snug">
                      {active.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {active.subtitle}
                    </p>

                    {/* Lista de Capacidades */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {active.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{f}</span>
                        </div>
                      ))}
                    </div>

                    {/* Métricas del Pilar */}
                    <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                      {active.metrics.map((m, i) => (
                        <div key={i} className="p-3 rounded-2xl bg-slate-950/80 border border-white/10 space-y-0.5">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">{m.label}</span>
                          <span className="text-lg sm:text-xl font-black text-cyan-300 font-mono block">{m.value}</span>
                          <span className="text-[10px] text-slate-400">{m.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Columna Derecha: Tarjeta Visual Interactiva */}
                  <div className="lg:col-span-5 relative">
                    <div className={`p-6 sm:p-8 rounded-3xl bg-gradient-to-br ${active.gradient} text-white shadow-2xl relative overflow-hidden group`}>
                      <div className="absolute top-0 right-0 p-6 opacity-15 group-hover:opacity-25 transition-opacity">
                        <ActiveIcon className="w-36 h-36" />
                      </div>

                      <div className="relative z-10 space-y-5">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                          <ActiveIcon className="w-7 h-7 text-white" />
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-black tracking-widest text-white/80">
                            Demostración En Vivo
                          </span>
                          <h4 className="text-xl font-black">
                            {active.title.split(' ')[0]} {active.title.split(' ')[1]} {active.title.split(' ')[2]}
                          </h4>
                        </div>

                        <p className="text-xs text-white/90 leading-relaxed font-medium">
                          Tu taller o tienda sincronizado en tiempo real con conductores, agencias y clientes.
                        </p>

                        <button
                          onClick={() => handleWhatsAppContact(`¡Hola! Me interesó la función de "${active.title}". ¿Cómo puedo activarla en mi negocio? 🚀`)}
                          className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                          <span>Consultar sobre este módulo</span>
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Controles de Navegación del Carrusel */}
                <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentSlide(i);
                          setAutoplay(false);
                        }}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          currentSlide === i ? 'w-8 bg-pink-500' : 'w-2 bg-slate-700 hover:bg-slate-500'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setCurrentSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1));
                        setAutoplay(false);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentSlide(prev => (prev + 1) % slides.length);
                        setAutoplay(false);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>

        {/* CALCULADORA DE TIEMPO & ROI AHORRADO */}
        <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-purple-950/40 to-slate-900 border border-purple-500/30 p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-black text-pink-400 uppercase tracking-widest block">
              CALCULADORA DE RENTABILIDAD
            </span>
            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              ¿Cuánto Tiempo y Dinero Ahorrarás al Mes?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Mueve la barra para ver el impacto inmediato en tu operación diaria.
            </p>
          </div>

          <div className="max-w-xl mx-auto space-y-6">
            <div className="space-y-3 bg-slate-950/80 p-5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Paquetes enviados por semana:</span>
                <span className="text-xl font-black text-pink-400 font-mono">{packagesPerWeek} envíos</span>
              </div>
              <input
                type="range"
                min="20"
                max="800"
                step="10"
                value={packagesPerWeek}
                onChange={e => setPackagesPerWeek(Number(e.target.value))}
                className="w-full accent-pink-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>20/sem</span>
                <span>200/sem</span>
                <span>500/sem</span>
                <span>800/sem</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-center space-y-1">
                <span className="text-xs font-bold text-slate-300 block">Tiempo Ahorrado al Mes</span>
                <span className="text-3xl sm:text-4xl font-black text-white font-mono block">
                  {hoursSavedPerMonth} hrs
                </span>
                <span className="text-[11px] text-purple-300">Menos colas y digitación</span>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-center space-y-1">
                <span className="text-xs font-bold text-slate-300 block">Ahorro Operativo Est.</span>
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono block">
                  S/ {moneySavedPerMonth}
                </span>
                <span className="text-[11px] text-emerald-300">En horas productivas</span>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARATIVA: MÉTODO TRADICIONAL VS ENCOMI OS */}
        <section className="space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">
              LA DIFERENCIA
            </span>
            <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Método Tradicional vs. Encomi Envíos OS
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Tradicional */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-rose-500/20 space-y-4">
              <div className="flex items-center gap-2.5 text-rose-400 font-bold text-base">
                <span className="text-lg">❌</span>
                <h4>Como se hacía antes</h4>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Escribir datos a mano en libretas o notas de WhatsApp desordenadas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Hacer colas en agencia Shalom para que la cajera digite paquete por paquete.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Tomarle foto a cada boleta de papel y enviarla una por una a cada clienta.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>Clientas preguntando todo el día: <em>"¿Ya salió mi paquete? ¿Cuál es mi clave?"</em>.</span>
                </li>
              </ul>
            </div>

            {/* Con Encomi */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-emerald-950/40 border border-emerald-500/40 space-y-4 shadow-xl shadow-emerald-950/20">
              <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
                <span className="text-lg">✨</span>
                <h4>Con Encomi Envíos OS</h4>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-200">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>La clienta registra su dirección y agencia verificada en 10 segundos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Carga masiva a Shalom Pro y generación de todas las guías PDF en 1 solo clic.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>WhatsApp automático envía el PDF oficial y la clave PIN sin tocar el teléfono.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>El bot de IA responde dudas de rastreo 24/7 y libera a tu equipo de atención.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA FINAL DE CONTACTO WHATSAPP */}
        <section className="relative rounded-3xl bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 p-8 sm:p-12 text-center text-white shadow-2xl space-y-6 overflow-hidden">
          <div className="absolute -right-10 -bottom-10 opacity-20 pointer-events-none">
            <Package className="w-64 h-64" />
          </div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-black uppercase tracking-wider backdrop-blur-sm inline-block">
              EMPIEZA HOY MISMO
            </span>

            <h3 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight">
              ¿Listo para Automatizar los Envíos de tu Marca?
            </h3>

            <p className="text-xs sm:text-base text-white/90 leading-relaxed font-medium">
              Contáctanos directamente para agendar una demostración personalizada o activar Encomi en tu Negocio.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => handleWhatsAppContact('¡Hola! Deseo hablar directamente para implementar Encomi Envíos en mi marca 🚀📲')}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-98 cursor-pointer group"
              >
                <MessageCircle className="w-5 h-5 fill-emerald-600 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>Contactar a WhatsApp: {CONTACT_PHONE}</span>
              </button>
            </div>

            <p className="text-[11px] text-white/75 pt-2">
              ⚡ Respuesta inmediata • Atención personalizada para marcas textiles y negocios
            </p>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-white/10 py-8 text-center text-xs text-slate-500">
        <p>© 2026 Encomi Envíos OS • Potenciando la Logística y Negocios del Perú 🇵🇪</p>
      </footer>

      {/* Botón Flotante Permanente de WhatsApp */}
      <div className="fixed bottom-6 right-6 z-50 animate-bounce" style={{ animationDuration: '3s' }}>
        <button
          onClick={() => handleWhatsAppContact('¡Hola! Vengo del funnel de Encomi Envíos y quiero información para mi empresa ✨')}
          className="p-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-2xl shadow-emerald-500/50 flex items-center gap-2 font-black text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Hablar por WhatsApp con un Asesor de Encomi"
        >
          <MessageCircle className="w-6 h-6 fill-current" />
          <span className="hidden sm:inline font-bold">WhatsApp Directo</span>
        </button>
      </div>

    </div>
  );
};
