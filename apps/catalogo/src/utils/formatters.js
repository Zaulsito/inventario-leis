// Convierte textos como "AMPOLLA SHOCK KERATINA" a "Ampolla Shock Keratina"
export const toTitleCase = (str) => {
  if (!str || typeof str !== 'string') return str || '';
  
  const lowercaseWords = new Set(['de', 'del', 'con', 'en', 'para', 'por', 'sin', 'y', 'e', 'o', 'u', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'a']);

  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (!word) return '';
      const cleanWord = word.replace(/^[^\wáéíóúñÁÉÍÓÚÑ]+|[^\wáéíóúñÁÉÍÓÚÑ]+$/g, '');
      if (index > 0 && lowercaseWords.has(cleanWord.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.replace(/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/, (char) => char.toUpperCase());
    })
    .join(' ');
};

// Formatea un número a moneda chilena (ej: 12500 -> "$12.500")
export const formatPrice = (price) => {
  return `$${(price || 0).toLocaleString('es-CL')}`;
};
