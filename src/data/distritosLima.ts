export const DISTRITOS_LIMA: string[] = [
  'Ancón',
  'Ate',
  'Barranco',
  'Breña',
  'Carabayllo',
  'Chaclacayo',
  'Chorrillos',
  'Cieneguilla',
  'Comas',
  'El Agustino',
  'Independencia',
  'Jesús María',
  'La Molina',
  'La Victoria',
  'Lima (Cercado)',
  'Lince',
  'Los Olivos',
  'Lurigancho-Chosica',
  'Lurín',
  'Magdalena del Mar',
  'Miraflores',
  'Pachacámac',
  'Pucusana',
  'Pueblo Libre',
  'Puente Piedra',
  'Punta Hermosa',
  'Punta Negra',
  'Rímac',
  'San Bartolo',
  'San Borja',
  'San Isidro',
  'San Juan de Lurigancho',
  'San Juan de Miraflores',
  'San Luis',
  'San Martín de Porres',
  'San Miguel',
  'Santa Anita',
  'Santa María del Mar',
  'Santa Rosa',
  'Santiago de Surco',
  'Surquillo',
  'Villa El Salvador',
  'Villa María del Triunfo'
];

/**
 * Búsqueda inteligente de distritos por coincidencia de subcadena
 * insensible a mayúsculas, minúsculas y tildes.
 * Ej: "vic" -> "La Victoria", "mira" -> "Miraflores", "san juan" -> "San Juan de Lurigancho", etc.
 */
export function searchDistritos(query: string): string[] {
  if (!query || !query.trim()) return DISTRITOS_LIMA;

  const normalize = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const normalizedQuery = normalize(query.trim());

  return DISTRITOS_LIMA.filter(distrito => {
    const normalizedDistrito = normalize(distrito);
    return normalizedDistrito.includes(normalizedQuery);
  });
}
