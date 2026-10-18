import { useEffect, useRef } from 'react'

/**
 * Hook para sincronizar el historial del navegador (botón Atrás en móvil y escritorio)
 * con el estado de apertura/cierre de modales interactivos.
 */
export function useModalHistory({
  activeModals = [],
  closeAllModals = () => {}
} = {}) {
  const anyOpen = activeModals.some(Boolean)
  const wasModalOpenRef = useRef(false)

  // Cerrar modales cuando se dispara popstate (botón atrás del navegador)
  useEffect(() => {
    const handlePopState = () => {
      if (anyOpen) {
        closeAllModals()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [anyOpen, closeAllModals])

  // Empujar o retroceder el historial al abrir/cerrar cualquier modal
  useEffect(() => {
    if (anyOpen && !wasModalOpenRef.current) {
      window.history.pushState({ modalOpen: true }, '')
      wasModalOpenRef.current = true
    } else if (!anyOpen && wasModalOpenRef.current) {
      if (window.history.state?.modalOpen) {
        window.history.back()
      }
      wasModalOpenRef.current = false
    }
  }, [anyOpen])
}

export default useModalHistory
