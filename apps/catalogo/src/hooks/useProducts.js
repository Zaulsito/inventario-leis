import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { toTitleCase } from '../utils/formatters'

/**
 * Hook para escuchar en tiempo real la lista de productos de Firestore,
 * aplicando formateo de nombre a título y ordenamiento alfabético.
 */
export function useProducts() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const data = snapshot.docs.map(dDoc => {
        const dData = dDoc.data()
        return { id: dDoc.id, ...dData, nombre: toTitleCase(dData.nombre) }
      })
      // Ordenar alfabéticamente
      data.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProductos(data)
      setLoading(false)
    })
    return unsub
  }, [])

  return { productos, loading, setProductos }
}

export default useProducts
