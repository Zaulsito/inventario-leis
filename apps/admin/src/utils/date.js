/**
 * Retorna la fecha actual en formato YYYY-MM-DD usando la zona
 * horaria LOCAL del dispositivo (no UTC).
 * Evita el bug clásico de toISOString() que devuelve la fecha UTC.
 */
export function getLocalDateString() {
  const d = new Date()
  const year  = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day   = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Retorna la hora actual en formato HH:mm usando la zona horaria LOCAL.
 */
export function getLocalTimeString() {
  const d = new Date()
  const hours   = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
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
 * e incluye la hora entre paréntesis: DD-MM-YYYY (HH:mm) si se proporciona o detecta.
 */
export function formatDateDMA(dateStr, extraObj = null) {
  if (!dateStr) return ''
  try {
    let timeStr = ''

    // 1. Extraer hora si existe en el objeto extra (hora, createdAt o id timestamp)
    if (extraObj && typeof extraObj === 'object') {
      if (extraObj.hora) {
        timeStr = extraObj.hora
      } else if (extraObj.createdAt) {
        const cd = new Date(extraObj.createdAt)
        if (!isNaN(cd.getTime())) {
          timeStr = `${String(cd.getHours()).padStart(2, '0')}:${String(cd.getMinutes()).padStart(2, '0')}`
        }
      } else if (extraObj.id && !isNaN(Number(extraObj.id)) && Number(extraObj.id) > 1500000000000) {
        const idDate = new Date(Number(extraObj.id))
        if (!isNaN(idDate.getTime())) {
          timeStr = `${String(idDate.getHours()).padStart(2, '0')}:${String(idDate.getMinutes()).padStart(2, '0')}`
        }
      }
    }

    // 2. Si dateStr contiene hora ISO o espacio (ej: 2026-08-31T21:43:12)
    if (typeof dateStr === 'string') {
      const clean = dateStr.trim()
      if (clean.includes('T') || clean.includes(' ')) {
        const d = new Date(clean)
        if (!isNaN(d.getTime())) {
          const day = String(d.getDate()).padStart(2, '0')
          const month = String(d.getMonth() + 1).padStart(2, '0')
          const year = d.getFullYear()
          const hours = String(d.getHours()).padStart(2, '0')
          const minutes = String(d.getMinutes()).padStart(2, '0')
          return `${day}-${month}-${year} (${hours}:${minutes})`
        }
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split('-')
        const base = `${d}-${m}-${y}`
        return timeStr ? `${base} (${timeStr})` : base
      }
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        return timeStr ? `${clean} (${timeStr})` : clean
      }
    }

    // 3. Fallback objeto Date
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      const hours = String(d.getHours()).padStart(2, '0')
      const minutes = String(d.getMinutes()).padStart(2, '0')
      if (!timeStr && (hours !== '00' || minutes !== '00')) {
        timeStr = `${hours}:${minutes}`
      }
      const base = `${day}-${month}-${year}`
      return timeStr ? `${base} (${timeStr})` : base
    }

    return String(dateStr)
  } catch (e) {
    return String(dateStr)
  }
}
