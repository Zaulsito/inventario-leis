/**
 * Retorna la fecha actual en formato YYYY-MM-DD usando la zona
 * horaria LOCAL del dispositivo (no UTC).
 * Evita el bug clásico de toISOString() que devuelve la fecha UTC,
 * lo que en Chile (UTC-3 / UTC-4) puede adelantar la fecha un día.
 */
export function getLocalDateString() {
  const d = new Date()
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calcula el estado de stock según las reglas del negocio:
 *   0        → 'sin_stock'
 *   1 – 5    → 'critico'
 *   6 – 10   → 'bajo'
 *   11+      → 'disponible'
 */
export function calcularEstado(stock) {
  const s = Number(stock)
  if (s <= 0)  return 'sin_stock'
  if (s <= 5)  return 'critico'
  if (s <= 10) return 'bajo'
  return 'disponible'
}

/**
 * Convierte una fecha en formato YYYY-MM-DD o ISO a DD-MM-YYYY (Día-Mes-Año)
 */
export function formatDateDMA(dateStr) {
  if (!dateStr) return ''
  try {
    if (typeof dateStr === 'string') {
      const clean = dateStr.trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split('-')
        return `${d}-${m}-${y}`
      }
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        return clean
      }
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return String(dateStr)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}-${month}-${year}`
  } catch (e) {
    return String(dateStr)
  }
}
