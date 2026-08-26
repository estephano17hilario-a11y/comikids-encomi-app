/**
 * ALGORITMO Y SERVICIO DE AHORRO DE TINTA INTELIGENTE (ECO-PRINT 2026)
 * Permite reducir el consumo de tinta/tóner entre 25% y 90% garantizando
 * que los datos críticos (DNI, Nombre, Destino, Tracking) sigan siendo 100% legibles.
 */

export type InkSavingLevel = 0 | 25 | 50 | 75 | 90;

export interface InkSavingConfig {
  level: InkSavingLevel;
  label: string;
  badge: string;
  description: string;
  tonerSavePercent: string;
}

export const INK_SAVING_LEVELS: Record<InkSavingLevel, InkSavingConfig> = {
  0: {
    level: 0,
    label: '0% Normal',
    badge: 'Full Color',
    description: 'Estándar con colores vivos y fondos completos.',
    tonerSavePercent: '0%',
  },
  25: {
    level: 25,
    label: '25% Eco',
    badge: 'Ahorro 25%',
    description: 'Fondos suavizados, menor opacidad de color.',
    tonerSavePercent: '25%',
  },
  50: {
    level: 50,
    label: '50% Medio',
    badge: 'Ahorro 50%',
    description: 'Sin fondos oscuros masivos, contornos nítidos.',
    tonerSavePercent: '50%',
  },
  75: {
    level: 75,
    label: '75% Alto',
    badge: 'Ahorro 75%',
    description: 'Tipografía delgada eco, trazos finos, 0 rellenos.',
    tonerSavePercent: '75%',
  },
  90: {
    level: 90,
    label: '90% Ultra',
    badge: 'Ahorro 90%',
    description: 'Máximo ahorro de tóner/tinta, tipografía micro-trazo, 100% legible.',
    tonerSavePercent: '90%',
  },
};

/**
 * Devuelve el conjunto de clases y estilos CSS calculados según el nivel de ahorro
 */
export const getInkSavingStyles = (level: InkSavingLevel) => {
  switch (level) {
    case 90:
      return {
        containerBorder: 'border border-dashed border-slate-700 bg-white text-slate-900',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
        fontGeneral: 'font-normal tracking-wide text-slate-900',
        destinoBox: 'bg-white text-black border-2 border-black p-2',
        destinoTitle: 'text-black font-black',
        destinoSub: 'text-slate-600 font-bold',
        dniBox: 'bg-white border-2 border-black text-black px-2 py-1',
        dniText: 'text-2xl font-mono font-black tracking-widest text-black',
        badgeCarrier: 'bg-white text-black border border-black',
        barcodeBar: 'bg-black opacity-80',
        barcodeHeight: 'h-6',
        barcodeMultiplier: 0.4,
        sectionBg: 'bg-white border border-dashed border-slate-400',
        subtleText: 'text-slate-700 font-medium',
        isUltraEco: true,
      };

    case 75:
      return {
        containerBorder: 'border-2 border-dashed border-slate-800 bg-white text-slate-900',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif",
        fontGeneral: 'font-medium tracking-normal text-slate-900',
        destinoBox: 'bg-white text-slate-950 border-2 border-slate-900 p-2.5',
        destinoTitle: 'text-slate-950 font-black',
        destinoSub: 'text-slate-700 font-bold',
        dniBox: 'bg-slate-50 border-2 border-slate-900 text-slate-950 px-2 py-1',
        dniText: 'text-2xl font-mono font-black tracking-widest text-slate-950',
        badgeCarrier: 'bg-slate-100 text-black border border-slate-700',
        barcodeBar: 'bg-slate-900',
        barcodeHeight: 'h-7',
        barcodeMultiplier: 0.6,
        sectionBg: 'bg-white border border-dashed border-slate-400',
        subtleText: 'text-slate-700 font-semibold',
        isUltraEco: false,
      };

    case 50:
      return {
        containerBorder: 'border-2 border-dashed border-slate-900 bg-white text-slate-900',
        fontFamily: 'Arial, sans-serif',
        fontGeneral: 'font-normal text-slate-900',
        destinoBox: 'bg-slate-100 text-slate-950 border-2 border-slate-900 p-2.5',
        destinoTitle: 'text-slate-950 font-black',
        destinoSub: 'text-slate-800 font-bold',
        dniBox: 'bg-slate-100 border-2 border-slate-900 text-slate-950 px-2 py-1',
        dniText: 'text-2xl font-mono font-black tracking-widest text-slate-950',
        badgeCarrier: 'bg-yellow-100 text-slate-900 border border-slate-800',
        barcodeBar: 'bg-slate-900',
        barcodeHeight: 'h-8',
        barcodeMultiplier: 0.8,
        sectionBg: 'bg-slate-50/80 border border-slate-300',
        subtleText: 'text-slate-700 font-semibold',
        isUltraEco: false,
      };

    case 25:
      return {
        containerBorder: 'border-3 border-dashed border-cyan-600 bg-white text-slate-900',
        fontFamily: 'Arial, sans-serif',
        fontGeneral: 'font-normal text-slate-900',
        destinoBox: 'bg-slate-900 text-white border-2 border-cyan-400 p-3',
        destinoTitle: 'text-white font-black',
        destinoSub: 'text-cyan-300 font-bold',
        dniBox: 'bg-slate-900 border-2 border-slate-800 text-white px-2.5 py-1',
        dniText: 'text-2xl font-mono font-black tracking-widest text-white',
        badgeCarrier: 'bg-yellow-300 text-slate-950 border border-black',
        barcodeBar: 'bg-slate-900',
        barcodeHeight: 'h-9',
        barcodeMultiplier: 0.9,
        sectionBg: 'bg-yellow-50/80 border-2 border-dashed border-slate-800',
        subtleText: 'text-slate-700 font-bold',
        isUltraEco: false,
      };

    case 0:
    default:
      return {
        containerBorder: 'border-4 border-dashed border-cyan-500 bg-white text-slate-900',
        fontFamily: 'Arial, sans-serif',
        fontGeneral: 'font-normal text-slate-900',
        destinoBox: 'bg-slate-950 text-white border-2 border-cyan-400 p-3 shadow-md',
        destinoTitle: 'text-white font-black',
        destinoSub: 'text-cyan-300 font-bold',
        dniBox: 'bg-slate-950 border-2 border-slate-800 text-white px-2.5 py-1.5 shadow-sm',
        dniText: 'text-2xl font-mono font-black tracking-widest text-white',
        badgeCarrier: 'bg-yellow-300 text-slate-950 border border-black',
        barcodeBar: 'bg-slate-900',
        barcodeHeight: 'h-9',
        barcodeMultiplier: 1.0,
        sectionBg: 'bg-yellow-50/70 border-2 border-dashed border-slate-900',
        subtleText: 'text-slate-700 font-bold',
        isUltraEco: false,
      };
  }
};
