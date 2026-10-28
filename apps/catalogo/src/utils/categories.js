export const CATEGORIAS_JOYERIA = [
  'JOYAS', 'JOYERIA', 'JOYERÍA',
  'ANILLOS', 'ANILLO',
  'AROS', 'ARO',
  'COLLAR', 'COLLARES',
  'CONJUNTO', 'CONJUNTOS',
  'PULSERA', 'PULSERAS'
];

export const esJoyería = (cat) => {
  if (!cat || typeof cat !== 'string') return false;
  const name = cat.toUpperCase().trim();
  return CATEGORIAS_JOYERIA.some(j => name === j || name.includes(j));
};

export const getCategoriaIcon = (catName) => {
  if (!catName || typeof catName !== 'string') return 'star_rate';
  const name = catName.toUpperCase().trim();
  if (name === 'TODAS') return 'grid_view';
  if (name === 'JOYERIA' || name === 'JOYAS' || name === 'JOYERÍA') return 'diamond';
  if (name.includes('ANILLO')) return 'panorama_fish_eye';
  if (name.includes('ANTIFAZ')) return 'theater_comedy';
  if (name.includes('ARO')) return 'trip_origin';
  if (name.includes('CEJA')) return 'face';
  if (name.includes('COLLAR')) return 'diamond';
  if (name.includes('CONJUNTO')) return 'auto_awesome_motion';
  if (name.includes('CORPORAL')) return 'accessibility_new';
  if (name.includes('CUIDADO') || name.includes('CAPILAR') || name.includes('CABELLO')) return 'spa';
  if (name.includes('LABIAL') || name.includes('LABIOS')) return 'volunteer_activism';
  if (name.includes('MAQUILLAJE') || name.includes('FACIAL')) return 'brush';
  if (name.includes('CREMA') || name.includes('PIEL')) return 'water_drop';
  if (name.includes('PERFUME') || name.includes('AROMA')) return 'air';
  return 'star_rate';
};
