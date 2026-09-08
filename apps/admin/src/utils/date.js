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
          const h = String(cd.getHours()).padStart(2, '0')
          const m = String(cd.getMinutes()).padStart(2, '0')
          if (h !== '00' || m !== '00') {
            const ampm = Number(h) >= 12 ? 'p. m.' : 'a. m.'
            const h12 = Number(h) % 12 || 12
            timeStr = `${String(h12).padStart(2, '0')}:${m} ${ampm}`
          }
        }
      }
    }

    // 2. Si dateStr es string
    if (typeof dateStr === 'string') {
      const clean = dateStr.trim()

      // Formato YYYY-MM-DD (ej: 2026-09-02)
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
        const [y, m, d] = clean.split('-')
        const base = `${d}-${m}-${y}`
        return timeStr ? `${base} (${timeStr})` : base
      }

      // Formato DD-MM-YYYY (ej: 02-09-2026)
      if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
        return timeStr ? `${clean} (${timeStr})` : clean
      }

      // Formato ISO con T o espacio (ej: 2026-09-02T00:00:00.000Z o 2026-09-02 14:30)
      if (clean.includes('T') || clean.includes(' ')) {
        const datePart = clean.split(/[T ]/)[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [y, m, d] = datePart.split('-')
          const base = `${d}-${m}-${y}`

          // Solo extraer hora si NO es medianoche UTC (T00:00:00)
          if (!clean.includes('T00:00:00') && !clean.includes(' 00:00:00')) {
            const parsed = new Date(clean)
            if (!isNaN(parsed.getTime())) {
              const hours = String(parsed.getHours()).padStart(2, '0')
              const minutes = String(parsed.getMinutes()).padStart(2, '0')
              if (hours !== '00' || minutes !== '00') {
                const ampm = Number(hours) >= 12 ? 'p. m.' : 'a. m.'
                const h12 = Number(hours) % 12 || 12
                timeStr = `${String(h12).padStart(2, '0')}:${minutes} ${ampm}`
              }
            }
          }
          return timeStr ? `${base} (${timeStr})` : base
        }
      }
    }

    // 3. Fallback objeto Date
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year = d.getFullYear()
      const base = `${day}-${month}-${year}`
      return timeStr ? `${base} (${timeStr})` : base
    }

    return String(dateStr)
  } catch (e) {
    return String(dateStr)
  }
}
