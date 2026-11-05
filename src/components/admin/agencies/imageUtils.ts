/**
 * Reduce una imagen subida a un cuadro pequeño (máx. 256 px) para que el logo pese pocos KB
 * y pueda sincronizarse en la nube sin problemas.
 */
export const resizeLogoFile = (file: File, maxSize = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Elige una imagen (JPG, PNG o WEBP).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      // Los SVG se dejan tal cual si son livianos
      if (file.type === 'image/svg+xml') {
        const out = reader.result as string;
        if (out.length > 150_000) reject(new Error('Ese logo es muy pesado. Prueba con otro.'));
        else resolve(out);
        return;
      }
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
      img.onload = () => {
        const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
