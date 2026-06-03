// src/pages/Inventario.jsx
import { useState, useEffect, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import BarcodeScanner from '../components/BarcodeScanner'
import { getLocalDateString } from '../utils/date'
import { calcularEstado } from '../utils/date'
import Footer from '../components/Footer'

const estadoConfig = {
  disponible: { label: 'Disponible', cls: 'bg-[#8b6b3e]/10 text-[#8b6b3e] dark:bg-[#8b6b3e]/20 dark:text-[#c4a484] border border-[#8b6b3e]/20 backdrop-blur-sm font-bold shadow-sm' },
  bajo:       { label: 'Stock bajo', cls: 'bg-[#e2bd6c]/10 text-[#e2bd6c] border border-[#e2bd6c]/20 backdrop-blur-sm font-bold shadow-sm' },
  critico:    { label: 'Crítico',    cls: 'bg-error/10 text-error font-bold border border-error/20 backdrop-blur-sm shadow-sm animate-pulse' },
  sin_stock:  { label: 'Sin stock',  cls: 'bg-gray-400/10 text-gray-400 border border-gray-400/20 backdrop-blur-sm font-bold' },
}

const IMGBB_API_KEY = '938080794446e62c3e8860d25353123b'

const formInicial = { 
  nombre: '', 
  sku: '', 
  coleccion: '', 
  proveedor: '', 
  marca: '',
  precio: '', 
  precioCosto: '', 
  stock: '', 
  ajusteStock: '',
  fechaIngreso: getLocalDateString(), 
  fotoUrl: '',
  fotos: [],
  descripcion: '',
  variantes: [],
  visibleEnCatalogo: true
}

const getHexColor = (name) => {
  if (!name) return null;
  const colors = {
    'azul': '#3b82f6',
    'rosado': '#ec4899',
    'rosa': '#ec4899',
    'burdeo': '#800020',
    'burdeos': '#800020',
    'verde': '#22c55e',
    'amarillo': '#eab308',
    'morado': '#a855f7',
    'púrpura': '#a855f7',
    'rojo': '#ef4444',
    'negro': '#000000',
    'blanco': '#ffffff',
    'gris': '#6b7280',
    'naranja': '#f97316',
    'celeste': '#0ea5e9',
    'café': '#78350f',
    'marrón': '#78350f',
    'beige': '#f5f5dc',
    'fucsia': '#d946ef',
    'cian': '#06b6d4',
    'esmeralda': '#10b981',
    'turquesa': '#14b8a6',
    'lila': '#d8b4fe',
    'lavanda': '#e9d5ff',
    'crema': '#fffdd0',
    'dorado': '#ffd700',
    'plata': '#c0c0c0',
    'bronce': '#cd7f32'
  };
  return colors[name.toLowerCase()] || null;
};

// Utilidad para normalizar texto (quitar acentos y convertir a minúsculas)
const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export default function Inventario() {
  const { isDark = false } = useOutletContext() || {}
  const [activeTabModal, setActiveTabModal] = useState('editar') // 'editar' | 'catalogo'
  const [previewImageIndex, setPreviewImageIndex] = useState(0)

  const plantillaCosmetica = `1. Propósito Principal:
• Restaurar la barrera de hidratación de forma inmediata y unificar el tono natural de la piel.
• [Tip/Sugerencia]: Ideal para aplicar como primer paso después de la limpieza. Prepara la piel y optimiza la absorción de los siguientes tratamientos de tu rutina.

2. Ingredientes Clave:
• Ácido Hialurónico Puro: Capaz de retener hasta 1000 veces su peso en agua para una hidratación profunda y rellenar líneas de expresión.
• Niacinamida al 5%: Regula el exceso de sebo, calma rojeces y difumina manchas para una piel visiblemente más uniforme.
• Extracto Orgánico de Aloe Vera: Calma instantáneamente, desinflama y promueve la regeneración celular activa en pieles sensibles.

3. Beneficios Detallados:
• Hidratación Tridimensional Activa: Mantiene la piel elástica y jugosa durante 24 horas continuas sin efecto graso ni obstruir los poros.
• Barrera Antioxidante Reforzada: Combate los radicales libres del ambiente y el envejecimiento digital (luz azul) potenciando la luminosidad.
• Absorción Ultra-Rápida: Textura ligera que se funde en segundos con la piel, dejando un acabado sedoso y aterciopelado de alta gama.

4. Modo de Uso Sugerido:
• Paso 1: Limpia y seca con suavidad el rostro, cuello y escote.
• Paso 2: Dosifica de 3 a 4 gotas directamente o en la yema de tus dedos.
• Paso 3: Distribuye con masajes ascendentes circulares y ligeros toques hasta su total absorción. ¡Apto para tu rutina de día y noche!

5. ¿Para quién es ideal?
• Tipo de Piel: Formulado para pieles secas, mixtas, sensibles o aquellas que muestren signos visibles de deshidratación y opacidad.
• Preocupación: Excelente contra la pérdida de elasticidad, líneas finas, textura irregular o piel apagada por el estrés diario.
• Combinación Perfecta: Acompáñalo con tu limpiador hidratante favorito y sella siempre con crema hidratante y protector solar FPS 50+ durante el día.`;

  const descriptionTextareaRef = useRef(null)

  function insertTextIntoDescription(textToInsert) {
    const textarea = descriptionTextareaRef.current
    if (!textarea) {
      setForm(prev => ({ ...prev, descripcion: (prev.descripcion || '') + textToInsert }))
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = form.descripcion || ''
    
    const newText = text.substring(0, start) + textToInsert + text.substring(end)
    
    setForm(prev => ({ ...prev, descripcion: newText }))
    
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length)
    }, 50)
  }

  function insertNumberedHeader() {
    const text = form.descripcion || ''
    const regex = /(?:^|\n)(\d+)\./g
    let match
    let maxNumber = 0
    while ((match = regex.exec(text)) !== null) {
      const num = parseInt(match[1], 10)
      if (num > maxNumber) {
        maxNumber = num
      }
    }
    const nextNumber = maxNumber + 1
    insertTextIntoDescription(`\n\n${nextNumber}. Nuevo Título:\n• `)
  }

  function insertBullet() {
    const textarea = descriptionTextareaRef.current
    if (!textarea) {
      insertTextIntoDescription('\n• ')
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = form.descripcion || ''

    if (start === end) {
      insertTextIntoDescription('\n• ')
    } else {
      const selectedText = text.substring(start, end)
      const lines = selectedText.split('\n')
      const bulletedLines = lines.map(line => {
        const trimmed = line.trim()
        if (trimmed === '') return line
        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          return line
        }
        const leadingWhitespace = line.match(/^\s*/)[0]
        const content = line.substring(leadingWhitespace.length)
        return leadingWhitespace + '• ' + content
      }).join('\n')

      const newText = text.substring(0, start) + bulletedLines + text.substring(end)
      setForm(prev => ({ ...prev, descripcion: newText }))

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start, start + bulletedLines.length)
      }, 50)
    }
  }

  function insertNumberedList() {
    const textarea = descriptionTextareaRef.current
    if (!textarea) {
      insertTextIntoDescription('\n1.- ')
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = form.descripcion || ''

    if (start === end) {
      insertTextIntoDescription('\n1.- ')
    } else {
      const selectedText = text.substring(start, end)
      const lines = selectedText.split('\n')
      
      let numberCounter = 1
      const numberedLines = lines.map(line => {
        const trimmed = line.trim()
        if (trimmed === '') return line
        
        const leadingWhitespace = line.match(/^\s*/)[0]
        const contentWithoutPrefix = line.substring(leadingWhitespace.length)
          .replace(/^(?:•|\-|\*|\d+\s*[\.\-]+\s*)\s*/, '')
        
        const formattedLine = `${leadingWhitespace}${numberCounter}.- ${contentWithoutPrefix}`
        numberCounter++
        return formattedLine
      }).join('\n')

      const newText = text.substring(0, start) + numberedLines + text.substring(end)
      setForm(prev => ({ ...prev, descripcion: newText }))

      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start, start + numberedLines.length)
      }, 50)
    }
  }

  function insertBold() {
    const textarea = descriptionTextareaRef.current
    if (!textarea) {
      insertTextIntoDescription('**Texto en Negrita**')
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = form.descripcion || ''

    if (start === end) {
      const placeholder = 'Texto en Negrita'
      const textToInsert = `**${placeholder}**`
      const newText = text.substring(0, start) + textToInsert + text.substring(end)
      setForm(prev => ({ ...prev, descripcion: newText }))
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + 2, start + 2 + placeholder.length)
      }, 50)
    } else {
      const selectedText = text.substring(start, end)
      const textToInsert = `**${selectedText}**`
      const newText = text.substring(0, start) + textToInsert + text.substring(end)
      setForm(prev => ({ ...prev, descripcion: newText }))
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start, start + textToInsert.length)
      }, 50)
    }
  }

  function clearDescription() {
    if (window.confirm('¿Estás seguro de que deseas vaciar todo el texto de la descripción?')) {
      setForm(prev => ({ ...prev, descripcion: '' }))
    }
  }

  async function autoFillWithAI() {
    setErrorMsg('');
    const apiKey = localStorage.getItem('gemini_api_key');
    if (!apiKey) {
      setTempApiKey('');
      setShowApiKeyModal(true);
      return;
    }

    setIsGeneratingAI(true);
    try {
      let imagePart = null;
      // Tratar de obtener la primera foto como base64 para análisis multimodal
      const fotosList = form.fotos || [];
      if (fotosList.length > 0) {
        const base64Img = await fetchImageAsBase64(fotosList[0]);
        if (base64Img) {
          imagePart = {
            inlineData: {
              data: base64Img.data,
              mimeType: base64Img.mimeType
            }
          };
        }
      }

      if (!form.nombre && !imagePart) {
        throw new Error('Por favor escribe el nombre del producto o sube una imagen de muestra para que la IA pueda identificar el producto.');
      }

      const promptText = `Eres un experto en marketing y cosmética premium para la marca Leis. Tu tarea es analizar el nombre del producto "${form.nombre || 'desconocido'}" y la imagen del producto (si está disponible) y redactar una descripción detallada, atractiva y profesional estructurada exactamente en las siguientes 5 secciones numeradas. Es FUNDAMENTAL que respetes el formato con números exactos y saltos de línea para que nuestro renderizador de catálogo lo formatee automáticamente como tarjetas separadas.

Usa exactamente la siguiente estructura de números y títulos (no uses otros números ni títulos):

1. Propósito Principal
[Describe en un párrafo fluido y persuasivo el propósito principal de este producto, qué hace y cómo ayuda al cliente. Mantén un tono elegante y sofisticado].

2. Ingredientes Clave
• **[Nombre del Ingrediente 1]:** [Breve descripción de su beneficio]
• **[Nombre del Ingrediente 2]:** [Breve descripción de su beneficio]
• **[Nombre del Ingrediente 3]:** [Breve descripción de su beneficio]

3. Beneficios Detallados
• **[Nombre del Beneficio 1]:** [Breve descripción]
• **[Nombre del Beneficio 2]:** [Breve descripción]
• **[Nombre del Beneficio 3]:** [Breve descripción]

4. Modo de Uso Sugerido
• **Paso 1:** [Descripción del paso]
• **Paso 2:** [Descripción del paso]
• **Paso 3:** [Descripción del paso]

5. ¿Para quién es ideal?
[Explica brevemente qué tipo de persona, tipo de piel, tipo de cabello o necesidad particular se beneficiará al máximo de este producto].

INSTRUCCIÓN IMPORTANTE PARA EL NOMBRE DEL PRODUCTO:
Si el nombre del producto no está definido en el formulario (o sea, es 'desconocido'), identifícalo directamente de la etiqueta de la botella/pote en la imagen de muestra (por ejemplo: "Crema Collagen", "Mascarilla de Colágeno Absolute Hair Beauty").
Si has identificado el nombre del producto desde la imagen (o deseas proponer una versión corregida y atractiva), escribe obligatoriamente en la primera línea de tu respuesta la palabra "PRODUCTO:" seguido del nombre identificado (ejemplo: "PRODUCTO: Mascarilla de Colágeno"). Luego da dos saltos de línea y comienza directamente con "1. Propósito Principal".
Si ya hay un nombre definido y no deseas cambiarlo, puedes omitir la línea "PRODUCTO:".

REGLAS DE FORMATO ESTRICTAS:
- No agregues introducciones ni conclusiones. Comienza directamente con "1. Propósito Principal" o la línea "PRODUCTO:".
- Asegúrate de usar el formato de negritas con doble asterisco \`**Texto**\` exactamente como se muestra para que el renderizador de catálogo resalte los nombres de los ingredientes y beneficios.
- No antes del título uses otros números o negrita como \`###\` o \`**1. Propósito Principal**\`. Usa exactamente "1. Propósito Principal" en la cabecera (el número y punto es lo que activa el formateo en el frontend).`;

      const contents = [
        {
          parts: [
            { text: promptText }
          ]
        }
      ];

      if (imagePart) {
        contents[0].parts.push(imagePart);
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 400 && errorData.error?.message?.includes('API key')) {
          localStorage.removeItem('gemini_api_key');
          throw new Error('API Key inválida. Por favor, vuelve a ingresarla.');
        }
        throw new Error(errorData.error?.message || `Error del servidor (${response.status})`);
      }

      const resData = await response.json();
      const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResult) {
        throw new Error('La IA no devolvió un resultado válido.');
      }

      let cleanTextResult = textResult.trim();
      let generatedName = "";

      if (cleanTextResult.startsWith("PRODUCTO:")) {
        const lines = cleanTextResult.split('\n');
        const firstLine = lines[0];
        generatedName = firstLine.replace("PRODUCTO:", "").trim();
        cleanTextResult = lines.slice(1).join('\n').trim();
      }

      setForm(prev => {
        const updated = { ...prev, descripcion: cleanTextResult };
        if (generatedName) {
          updated.nombre = generatedName;
        }
        return updated;
      });

    } catch (e) {
      console.error(e);
      setErrorMsg('Error de IA: ' + e.message);
    } finally {
      setIsGeneratingAI(false);
    }
  }

  async function fetchImageAsBase64(url) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result.split(',')[1];
          resolve({ data: base64data, mimeType: blob.type });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn("No se pudo obtener la imagen en base64 debido a CORS. Usando fallback de URL en texto.");
      return null;
    }
  }

  const [busqueda, setBusqueda]   = useState('')
  const [filtroCol, setFiltroCol] = useState('TODOS')
  const [orden, setOrden]         = useState('alfabetico-asc')
  const [productos, setProductos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [esNuevaCategoria, setEsNuevaCategoria] = useState(false)
  const [esNuevoProveedor, setEsNuevoProveedor] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [showProvDropdown, setShowProvDropdown] = useState(false)
  const [showMarcaDropdown, setShowMarcaDropdown] = useState(false)
  const [showOrdenDropdown, setShowOrdenDropdown] = useState(false)
  const [busquedaCat, setBusquedaCat] = useState('')
  const [busquedaProv, setBusquedaProv] = useState('')
  const [busquedaMarca, setBusquedaMarca] = useState('')
  const categoryContainerRef = useRef(null)

  // Estados del CRUD
  const [showModal, setShowModal] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [form, setForm] = useState(formInicial)
  const [editingId, setEditingId] = useState(null)
  const [expandedProduct, setExpandedProduct] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)
  
  // AI generation states
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [tempApiKey, setTempApiKey] = useState('')
  
  // Historial
  const [historyProductId, setHistoryProductId] = useState(null)
  const [historyLogs, setHistoryLogs] = useState([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // Paginación
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setProductos(data)
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
  }, [showModal])

  // --- Back button closing for mobile/browser history ---
  useEffect(() => {
    const handlePopState = (event) => {
      if (showModal || showHistoryModal) {
        setShowModal(false);
        setShowHistoryModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showModal, showHistoryModal]);

  const wasModalOpenRef = useRef(false);

  useEffect(() => {
    const anyOpen = showModal || showHistoryModal;
    if (anyOpen && !wasModalOpenRef.current) {
      window.history.pushState({ modalOpen: true }, '');
      wasModalOpenRef.current = true;
    } else if (!anyOpen && wasModalOpenRef.current) {
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
      wasModalOpenRef.current = false;
    }
  }, [showModal, showHistoryModal]);

  // Handlers del CRUD
  function openNew() {
    setForm(formInicial)
    setEditingId(null)
    setErrorMsg('')
    setEsNuevaCategoria(false)
    setEsNuevoProveedor(false)
    setActiveTabModal('editar')
    setPreviewImageIndex(0)
    setShowModal(true)
  }

  function openEdit(p) {
    setForm({ 
      nombre: p.nombre, 
      sku: p.sku, 
      coleccion: (p.coleccion || '').trim().toUpperCase(), 
      proveedor: (p.proveedor || '').trim().toUpperCase(),
      marca: (p.marca || '').trim().toUpperCase(),
      precio: p.precio, 
      precioCosto: p.precioCosto || '',
      stock: p.stock, 
      ajusteStock: '',
      fechaIngreso: p.fechaIngreso || getLocalDateString(), 
      fotoUrl: p.fotoUrl || '',
      fotos: p.fotos ? [...p.fotos] : (p.fotoUrl ? [p.fotoUrl] : []),
      descripcion: p.descripcion || '',
      variantes: p.variantes ? p.variantes.map(v => ({...v})) : [],
      visibleEnCatalogo: p.visibleEnCatalogo !== false
    })
    setEditingId(p.id)
    setErrorMsg('')
    setEsNuevaCategoria(false)
    setEsNuevoProveedor(false)
    setActiveTabModal('editar')
    setPreviewImageIndex(0)
    setShowModal(true)
  }

  async function openHistory(pId) {
    setHistoryProductId(pId)
    setIsHistoryLoading(true)
    setHistoryLogs([])
    setShowHistoryModal(true)
    
    try {
      const q = query(
        collection(db, 'historial_inventario'), 
        where('productoId', '==', pId)
      )
      const snapshot = await getDocs(q)
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Ordenar en memoria para evitar requerir un índice compuesto en Firestore
      logs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      setHistoryLogs(logs)
    } catch (e) {
      console.error("Error cargando historial", e)
    } finally {
      setIsHistoryLoading(false)
    }
  }

  async function handleDelete(id) {
    if (window.confirm("¿Estás seguro de eliminar este producto de la base de datos?")) {
      await deleteDoc(doc(db, 'productos', id))
    }
  }

  async function handleSave() {
    setErrorMsg('')
    if (!form.nombre || !form.sku || !form.coleccion) {
      return setErrorMsg('Nombre, Cód. Barra y Categoría son obligatorios.')
    }
    
    // Validar duplicados
    const duplicate = productos.find(p => 
      p.id !== editingId && 
      (p.sku.toLowerCase() === form.sku.toLowerCase() || p.nombre.toLowerCase() === form.nombre.toLowerCase())
    )

    if (duplicate) {
      return setErrorMsg('Ya existe un producto con el mismo Nombre o Cód. Barra.')
    }

    const prodAnterior = editingId ? productos.find(p => p.id === editingId) : null;
    const stockAnterior = prodAnterior ? Number(prodAnterior.stock) : 0;

    let stockCalculado = 0;
    if (form.variantes && form.variantes.length > 0) {
      stockCalculado = form.variantes.reduce((sum, v) => sum + Number(v.stock), 0);
    } else if (editingId) {
      stockCalculado = stockAnterior + Number(form.ajusteStock || 0);
    } else {
      stockCalculado = Math.floor(Number(form.stock));
    }

    const estadoFinal = calcularEstado(stockCalculado)
    
    const payload = {
      nombre: form.nombre,
      sku: form.sku,
      coleccion: form.coleccion.trim().toUpperCase(),
      proveedor: (form.proveedor || '').trim().toUpperCase(),
      marca: (form.marca || '').trim().toUpperCase(),
      precio: Math.floor(Number(form.precio)) || 0,
      precioCosto: Math.floor(Number(form.precioCosto)) || 0,
      stock: stockCalculado,
      variantes: (form.variantes || []).map(v => ({ ...v, stock: Number(v.stock) })),
      estado: estadoFinal,
      fechaIngreso: form.fechaIngreso,
      fotoUrl: form.fotos && form.fotos.length > 0 ? form.fotos[0] : '',
      fotos: form.fotos || [],
      descripcion: form.descripcion || '',
      visibleEnCatalogo: form.visibleEnCatalogo !== false
    }

    try {
      let savedId = editingId;
      if (editingId) {
        const variantesAnteriores = prodAnterior ? (prodAnterior.variantes || []) : [];
        
        await updateDoc(doc(db, 'productos', editingId), payload);
        
        if (form.variantes && form.variantes.length > 0) {
          for (const vNuevo of form.variantes) {
            const vAnterior = variantesAnteriores.find(v => v.nombre === vNuevo.nombre);
            const stockVAnterior = vAnterior ? Number(vAnterior.stock) : 0;
            const stockVNuevo = Number(vNuevo.stock);
            
            if (stockVNuevo !== stockVAnterior) {
              const dif = stockVNuevo - stockVAnterior;
              const accion = dif > 0 ? `Se sumaron ${dif} (${vNuevo.nombre})` : `Se restaron ${Math.abs(dif)} (${vNuevo.nombre})`;
              await addDoc(collection(db, 'historial_inventario'), {
                productoId: editingId,
                fecha: new Date().toISOString(),
                accion: accion,
                cambio: dif,
                stockAnterior: stockVAnterior,
                stockNuevo: stockVNuevo,
                motivo: "Edición manual de variante"
              });
            }
          }
        } else {
          if (stockCalculado !== stockAnterior) {
            const diferencia = stockCalculado - stockAnterior;
            const accion = diferencia > 0 ? `Se sumaron ${diferencia}` : `Se restaron ${Math.abs(diferencia)}`;
            await addDoc(collection(db, 'historial_inventario'), {
              productoId: editingId,
              fecha: new Date().toISOString(),
              accion: accion,
              cambio: diferencia,
              stockAnterior: stockAnterior,
              stockNuevo: stockCalculado,
              motivo: "Edición manual desde panel"
            });
          }
        }
      } else {
        const docRef = await addDoc(collection(db, 'productos'), payload);
        savedId = docRef.id;

        if (form.variantes && form.variantes.length > 0) {
          for (const v of form.variantes) {
            await addDoc(collection(db, 'historial_inventario'), {
              productoId: savedId,
              fecha: new Date().toISOString(),
              accion: `Creación inicial (${v.nombre})`,
              cambio: Number(v.stock),
              stockAnterior: 0,
              stockNuevo: Number(v.stock),
              motivo: "Nuevo producto (Variante)"
            });
          }
        } else {
          await addDoc(collection(db, 'historial_inventario'), {
            productoId: savedId,
            fecha: new Date().toISOString(),
            accion: `Creación inicial`,
            cambio: stockCalculado,
            stockAnterior: 0,
            stockNuevo: stockCalculado,
            motivo: "Nuevo producto"
          });
        }
      }
      setShowModal(false)
    } catch (e) {
      setErrorMsg('Error al guardar: ' + e.message)
    }
  }

  async function handleImageUpload(files) {
    if (!files || files.length === 0) return;

    const currentPhotos = form.fotos || [];
    const spaceLeft = 5 - currentPhotos.length;
    
    if (spaceLeft <= 0) {
      setErrorMsg('Máximo 5 imágenes permitidas.');
      return;
    }

    const filesToUpload = Array.from(files).slice(0, spaceLeft);

    setIsUploadingImage(true);
    setUploadProgress(`Subiendo 0 de ${filesToUpload.length}...`);
    setErrorMsg('');

    try {
      const newUrls = [];
      let completados = 0;

      await Promise.all(filesToUpload.map(async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        
        try {
           const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData,
           });
           const data = await response.json();
           if (data.success) {
             newUrls.push(data.data.url);
             completados++;
             setUploadProgress(`Subiendo ${completados} de ${filesToUpload.length}...`);
           }
        } catch (err) {
           console.error("Error subiendo una imagen", err);
        }
      }));

      setForm(prev => ({
        ...prev,
        fotos: [...(prev.fotos || []), ...newUrls]
      }));

    } catch (error) {
      setErrorMsg('Error de conexión al subir la imagen.');
    } finally {
      setIsUploadingImage(false);
      setUploadProgress('');
    }
  }

  function onFileInputChange(e) {
    handleImageUpload(e.target.files);
    e.target.value = '';
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleImageUpload(e.dataTransfer.files);
    }
  }

  // Calculos de tabla
  const categoriasUnicas = [...new Set(productos.map(p => (p.coleccion || '').trim().toUpperCase()))].filter(Boolean).sort()
  const proveedoresUnicos = [...new Set(productos.map(p => (p.proveedor || '').trim().toUpperCase()))].filter(Boolean).sort()
  const marcasUnicas = [...new Set(productos.map(p => (p.marca || '').trim().toUpperCase()))].filter(Boolean).sort()
  const colecciones = ['TODOS', ...categoriasUnicas]

  const filtrados = productos.filter(p => {
    const searchTerm = normalizeText(busqueda);
    const matchBusq = normalizeText(p.nombre).includes(searchTerm) || normalizeText(p.sku).includes(searchTerm)
    const matchCol  = filtroCol === 'TODOS' || (p.coleccion || '').trim().toUpperCase() === filtroCol
    return matchBusq && matchCol
  })

  // Resetear paginación al filtrar
  useEffect(() => {
    setCurrentPage(1)
  }, [busqueda, filtroCol, orden])

  const totalPages = Math.ceil(filtrados.length / itemsPerPage)
  const paginatedProducts = filtrados.sort((a, b) => {
    if (orden === 'alfabetico-asc') return a.nombre.localeCompare(b.nombre)
    if (orden === 'alfabetico-desc') return b.nombre.localeCompare(a.nombre)
    if (orden === 'fecha-desc') return new Date(b.fechaIngreso) - new Date(a.fechaIngreso)
    if (orden === 'stock-desc') return b.stock - a.stock
    if (orden === 'stock-asc') return a.stock - b.stock
    if (orden === 'precio-desc') return b.precio - a.precio
    if (orden === 'precio-asc') return a.precio - b.precio
    return 0
  }).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  function scrollCategories(direction) {
    if (categoryContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      categoryContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const totalSKUs    = filtrados.length
  const bajosDeStock = filtrados.filter(p => p.estado === 'bajo' || p.estado === 'critico').length
  const valorTotal   = filtrados.reduce((acc, p) => acc + (p.stock * (p.precio || 0)), 0)
  const valorTotalCosto = filtrados.reduce((acc, p) => acc + (p.stock * (p.precioCosto || 0)), 0)
  const stockTotal   = filtrados.reduce((acc, p) => acc + p.stock, 0)

  function porcBarra(stock) {
    if (productos.length === 0) return 0
    const max = Math.max(...productos.map(p => p.stock))
    return Math.round((stock / max) * 100)
  }

  function exportarCSV() {
    const encabezados = ['Producto', 'Marca', 'Cód. Barra', 'Categoría', 'Stock', 'Precio Costo', 'Precio Venta', 'Ganancia', 'Margen %', 'Estado', 'Fecha Ingreso']
    const filas = []
    
    filtrados.forEach(p => {
      const ganancia = (p.precio || 0) - (p.precioCosto || 0)
      const margen = p.precioCosto > 0 ? ((ganancia / p.precioCosto) * 100).toFixed(1) : '0.0'
      if (p.variantes && p.variantes.length > 0) {
        p.variantes.forEach(v => {
          filas.push([
            `"${(p.nombre || '').replace(/"/g, '""')} (${v.nombre.toUpperCase()})"`,
            `"${(p.marca || '').replace(/"/g, '""')}"`,
            `"${(p.sku || '').replace(/"/g, '""')}"`,
            `"${(p.coleccion || '').toUpperCase().replace(/"/g, '""')}"`,
            v.stock,
            p.precioCosto || 0,
            p.precio,
            ganancia,
            margen,
            `"${calcularEstado(v.stock).toUpperCase()}"`,
            `"${p.fechaIngreso || ''}"`
          ])
        })
      } else {
        filas.push([
          `"${(p.nombre || '').replace(/"/g, '""')}"`,
          `"${(p.marca || '').replace(/"/g, '""')}"`,
          `"${(p.sku || '').replace(/"/g, '""')}"`,
          `"${(p.coleccion || '').toUpperCase().replace(/"/g, '""')}"`,
          p.stock,
          p.precioCosto || 0,
          p.precio,
          ganancia,
          margen,
          `"${(p.estado || '').toUpperCase()}"`,
          `"${p.fechaIngreso || ''}"`
        ])
      }
    })
    
    const csvContent = encabezados.join(";") + "\n" + filas.map(e => e.join(";")).join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "inventario_leis.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportarPDF() {
    try {
      const doc = new jsPDF()
      doc.setFontSize(20)
      doc.setTextColor(139, 115, 85)
      doc.setFont("helvetica", "bold")
      doc.text("Reporte de Inventario - Leis", 14, 20)
      
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.setFont("helvetica", "normal")
      doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28)
      
      const tableData = []
      filtrados.forEach(p => {
        const ganancia = (p.precio || 0) - (p.precioCosto || 0)
        const margen = p.precioCosto > 0 ? ((ganancia / p.precioCosto) * 100).toFixed(1) + '%' : '0.0%'
        if (p.variantes && p.variantes.length > 0) {
          p.variantes.forEach(v => {
            tableData.push([
              `${p.nombre} (${v.nombre.toUpperCase()})`,
              p.marca || '-',
              p.sku,
              p.coleccion,
              v.stock.toString(),
              `$${(p.precioCosto || 0).toLocaleString('es-CL')}`,
              `$${(p.precio || 0).toLocaleString('es-CL')}`,
              `$${ganancia.toLocaleString('es-CL')} (${margen})`,
              calcularEstado(v.stock).toUpperCase(),
              p.fechaIngreso || '-'
            ])
          })
        } else {
          tableData.push([
            p.nombre,
            p.marca || '-',
            p.sku,
            p.coleccion,
            p.stock.toString(),
            `$${(p.precioCosto || 0).toLocaleString('es-CL')}`,
            `$${(p.precio || 0).toLocaleString('es-CL')}`,
            `$${ganancia.toLocaleString('es-CL')} (${margen})`,
            p.estado.toUpperCase(),
            p.fechaIngreso || '-'
          ])
        }
      })

      autoTable(doc, {
        startY: 35,
        head: [['Producto', 'Marca', 'Cód. Barra', 'Categoría', 'Stock', 'P. Costo', 'P. Venta', 'Ganancia', 'Estado', 'Fecha Ing.']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 3,
          lineColor: [255, 255, 255],
          lineWidth: 1,
        },
        headStyles: {
          fillColor: [139, 115, 85],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          lineWidth: 0,
        },
        bodyStyles: {
          fillColor: [248, 245, 238],
          textColor: [60, 60, 60],
          valign: 'middle',
        },
        columnStyles: {
          4: { halign: 'center' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' },
          7: { halign: 'right' },
          8: { halign: 'center' },
        },
        alternateRowStyles: {
          fillColor: [242, 238, 228],
        },
        margin: { left: 10, right: 10 },
      })
      doc.save("inventario_leis.pdf")
    } catch (e) {
      console.error("Error PDF:", e)
      alert("Hubo un error al generar el PDF. Revisa la consola.")
    }
  }

  return (
    <div className="p-8 md:p-10 relative flex flex-col min-h-full overflow-y-auto transition-colors duration-500">

      <header className="sticky top-0 z-30 bg-surface/80 dark:bg-[#121212]/80 backdrop-blur-md px-8 md:px-10 py-8 flex flex-col items-center justify-center border-b border-outline-variant/20 dark:border-white/5 tour-inv-header">
        <div className="relative text-center mx-auto">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 dark:text-[#e2bd6c]/60 mb-2">Control de Existencias</p>
          <h1 className="font-headline text-5xl text-secondary dark:text-white italic leading-tight tracking-tighter luxe-reveal">Inventario Maestro</h1>
          <div className="absolute left-1/2 -bottom-4 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-primary/20 dark:via-[#e2bd6c]/20 to-transparent rounded-full" />
        </div>
      </header>

      <div className="space-y-8">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tour-inv-metricas">
          <div className="bg-surface-container-low dark:bg-white/5 p-6 rounded-xl flex flex-col justify-between h-36 border border-outline-variant/10 dark:border-white/5">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-2xl">deployed_code</span>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-outline dark:text-[#e2bd6c]/80 leading-none">Total Productos</p>
            </div>
            <p className="text-3xl font-headline italic font-bold dark:text-white">{totalSKUs.toLocaleString()}</p>
          </div>

          <div className="bg-surface-container-highest dark:bg-white/5 p-4 rounded-xl flex flex-col justify-between h-36 border border-outline-variant/10 dark:border-white/5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary dark:text-[#e2bd6c] text-xl">payments</span>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-outline dark:text-[#e2bd6c]/80 leading-none">Valor Inventario</p>
            </div>
            <div className="flex flex-col gap-0.5 text-xs text-on-surface-variant dark:text-white/70">
              <div className="flex justify-between font-bold">
                <span>Venta:</span>
                <span className="dark:text-white">${valorTotal.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between">
                <span>Costo:</span>
                <span className="dark:text-white">${valorTotalCosto.toLocaleString('es-CL')}</span>
              </div>
              <div className="flex justify-between text-[#22c55e] dark:text-[#10b981] font-bold border-t border-outline-variant/10 dark:border-white/10 pt-0.5 mt-0.5 animate-pulse">
                <span>Ganancia:</span>
                <span>+${(valorTotal - valorTotalCosto).toLocaleString('es-CL')} ({valorTotalCosto > 0 ? (((valorTotal - valorTotalCosto) / valorTotalCosto) * 100).toFixed(1) : '0.0'}%)</span>
              </div>
            </div>
          </div>

          <div className="bg-secondary-container/20 dark:bg-white/5 p-6 rounded-xl flex flex-col justify-between h-36 border border-secondary-container/30 dark:border-white/5">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary dark:text-[#e2bd6c] text-2xl">inventory_2</span>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-secondary dark:text-[#e2bd6c]/80 leading-none">Unidades totales</p>
            </div>
            <p className="text-3xl font-headline italic font-bold text-secondary dark:text-white">{stockTotal.toLocaleString()}</p>
          </div>

          <div className={`p-6 rounded-xl flex flex-col justify-between h-36 border transition-all ${bajosDeStock > 0 ? 'bg-error/10 border-error/30 dark:bg-error/20 dark:border-error/40 backdrop-blur-md shadow-lg shadow-error/5' : 'bg-primary-container dark:bg-white/5 border-primary/10 dark:border-white/5'}`}>
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-2xl ${bajosDeStock > 0 ? 'text-error animate-pulse' : 'text-on-primary-container dark:text-white/60'}`}>priority_high</span>
              <p className={`text-[9px] uppercase tracking-widest font-extrabold leading-none ${bajosDeStock > 0 ? 'text-error' : 'text-on-primary-container dark:text-white/60'}`}>Stock Bajo</p>
            </div>
            <p className={`text-3xl font-headline italic font-bold ${bajosDeStock > 0 ? 'text-error' : 'text-on-primary-container dark:text-white'}`}>{bajosDeStock}</p>
          </div>
        </div>

        <div className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl shadow-sm overflow-visible border border-outline-variant/10 dark:border-white/5">
          <div className="p-4 md:p-7 pb-8 border-b-2 border-outline-variant/30 dark:border-white/5 bg-surface-container/50 dark:bg-white/5 space-y-6 rounded-t-3xl overflow-visible">
            
            <div className="relative flex items-center group">
              <button 
                onClick={() => scrollCategories('left')} 
                className="absolute left-0 z-10 bg-surface/80 backdrop-blur-md p-1.5 rounded-full shadow-md border border-outline-variant/20 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center scale-90"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              
              <div 
                ref={categoryContainerRef}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth px-2 py-1 flex-1 mask-horizontal-fade"
              >
                {colecciones.map(c => (
                  <button
                    key={c}
                    onClick={() => setFiltroCol(c)}
                    className={`px-6 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.15em] rounded-full border transition-all whitespace-nowrap shrink-0
                      ${filtroCol === c
                        ? 'bg-secondary dark:bg-[#e2bd6c] text-white dark:text-black border-secondary dark:border-[#e2bd6c] shadow-md scale-105'
                        : 'border-outline-variant/40 dark:border-white/20 text-on-surface-variant dark:text-white/70 hover:bg-surface/80 dark:hover:bg-white/10 hover:border-outline-variant dark:hover:border-[#e2bd6c]/50'
                      }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => scrollCategories('right')} 
                className="absolute right-0 z-10 bg-surface/80 backdrop-blur-md p-1.5 rounded-full shadow-md border border-outline-variant/20 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center scale-90"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
            
            <div className="flex flex-col xl:flex-row gap-4 pt-2 border-t border-outline-variant/10">
              <div className="flex flex-col md:flex-row gap-3 flex-1">
                <div className="flex items-center gap-2 flex-1 max-w-2xl">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline dark:text-gray-400 text-sm">search</span>
                    <input
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre o código..."
                      className="w-full bg-surface-container-low dark:bg-[#121212] rounded-xl pl-10 pr-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container dark:focus:ring-[#e2bd6c]/20 border border-outline-variant/20 dark:border-white/10 transition-all font-bold placeholder:font-normal dark:text-white dark:placeholder:text-gray-500"
                    />
                  </div>
                  
                  <div className="relative shrink-0">
                    <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2.5 bg-surface-container-low dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-xl hover:bg-surface dark:hover:bg-white/5 transition-colors flex items-center justify-center text-on-surface-variant dark:text-white/70 shadow-sm h-[42px] px-3">
                      <span className="material-symbols-outlined text-lg">more_horiz</span>
                    </button>
                    {showExportMenu && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowExportMenu(false)} />
                        <div className="absolute right-0 mt-2 w-48 bg-surface-container-highest dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-xl shadow-xl z-[70] py-2 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <button onClick={() => { exportarPDF(); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-variant/50 dark:hover:bg-white/5 text-[11px] font-bold uppercase tracking-widest text-on-surface dark:text-white/90 transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-error text-lg">picture_as_pdf</span>
                            Exportar a PDF
                          </button>
                          <button onClick={() => { exportarCSV(); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-variant/50 dark:hover:bg-white/5 text-[11px] font-bold uppercase tracking-widest text-on-surface dark:text-white/90 transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-green-600 dark:text-green-500 text-lg">csv</span>
                            Exportar a CSV
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-1 md:flex-none h-[42px]">
                  <div className="relative flex-1 md:flex-none h-full">
                    <button 
                      onClick={() => setShowOrdenDropdown(!showOrdenDropdown)}
                      className="flex items-center bg-surface-container-low dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-3 md:px-4 gap-2 md:gap-3 hover:bg-surface-variant/30 dark:hover:bg-white/5 transition-all shadow-sm min-w-[120px] md:min-w-[150px] justify-between h-full"
                    >
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="material-symbols-outlined text-sm text-primary dark:text-[#e2bd6c]">sort</span>
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface dark:text-white/80 whitespace-nowrap">
                          {orden === 'alfabetico-asc' && 'A - Z'}
                          {orden === 'alfabetico-desc' && 'Z - A'}
                          {orden === 'fecha-desc' && 'Reciente'}
                          {orden === 'stock-desc' && 'Stock Max'}
                          {orden === 'stock-asc' && 'Stock Min'}
                          {orden === 'precio-desc' && 'Precio Max'}
                          {orden === 'precio-asc' && 'Precio Min'}
                        </span>
                      </div>
                      <span className={`material-symbols-outlined text-sm opacity-40 transition-transform duration-300 ${showOrdenDropdown ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>

                    {showOrdenDropdown && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowOrdenDropdown(false)} />
                        <div className="absolute left-0 top-full mt-2 w-[220px] bg-surface-container-highest dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          {[
                            { id: 'alfabetico-asc', label: 'A - Z', icon: 'sort_by_alpha' },
                            { id: 'alfabetico-desc', label: 'Z - A', icon: 'sort_by_alpha' },
                            { id: 'fecha-desc', label: 'Más reciente', icon: 'calendar_today' },
                            { id: 'stock-desc', label: 'Mayor Stock', icon: 'trending_down' },
                            { id: 'stock-asc', label: 'Menor Stock', icon: 'trending_up' },
                            { id: 'precio-desc', label: 'Mayor Precio', icon: 'payments' },
                            { id: 'precio-asc', label: 'Menor Precio', icon: 'sell' },
                          ].map((opc) => (
                            <button
                              key={opc.id}
                              onClick={() => { setOrden(opc.id); setShowOrdenDropdown(false); }}
                              className={`w-full flex items-center gap-4 px-6 py-4 text-[11px] font-extrabold uppercase tracking-[0.15em] transition-all text-left border-b border-outline-variant/5 dark:border-white/5 last:border-0
                                ${orden === opc.id 
                                  ? 'bg-primary/15 dark:bg-[#e2bd6c]/20 text-primary dark:text-[#f3d692]' 
                                  : 'text-on-surface dark:text-white/90 hover:bg-surface-variant/50 dark:hover:bg-white/10'}`}
                            >
                              <span className={`material-symbols-outlined text-xl ${orden === opc.id ? 'text-primary dark:text-[#f3d692]' : 'text-outline dark:text-white/40'}`}>
                                {opc.icon}
                              </span>
                              <span>{opc.label}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  <button onClick={openNew} className="flex-1 md:flex-none h-full flex items-center justify-center gap-1.5 md:gap-2 bg-secondary text-white px-3 md:px-5 rounded-xl font-label font-bold uppercase text-[9px] md:text-[10px] tracking-tight md:tracking-widest shadow-md hover:shadow-lg hover:scale-105 transition-all tour-inv-nuevo whitespace-nowrap">
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span className="hidden sm:inline">Nuevo Producto</span>
                    <span className="sm:hidden">Nuevo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:hidden divide-y divide-outline-variant/10">
            {paginatedProducts.map((p) => {
              const est = estadoConfig[p.estado] || estadoConfig.disponible
              const isExpanded = expandedProduct === p.id
              
              return (
                <div key={p.id} className="bg-surface-container-low dark:bg-[#1e1e1e] overflow-hidden transition-all duration-300">
                  <div 
                    onClick={() => setExpandedProduct(isExpanded ? null : p.id)}
                    className="p-4 flex items-center gap-4 active:bg-surface-variant/20 dark:active:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-xl bg-surface-container dark:bg-white/5 overflow-hidden shrink-0 border border-outline-variant/20 dark:border-white/5 shadow-sm flex items-center justify-center">
                      {p.fotoUrl ? (
                        <img 
                          src={p.fotoUrl} 
                          alt={p.nombre} 
                          className="w-full h-full object-cover"
                          onClick={(e) => { e.stopPropagation(); setExpandedImage(p.fotoUrl); }}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-outline/40">image</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-headline font-bold text-base text-on-surface dark:text-white/90 truncate leading-tight mb-0.5 flex items-center gap-2">
                        <span>{p.nombre}</span>
                        {p.visibleEnCatalogo === false && (
                          <span className="inline-flex items-center gap-1 text-[8px] bg-error-container/20 text-error px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-error/10 shrink-0">
                            <span className="material-symbols-outlined text-[10px]">visibility_off</span>
                            Oculto
                          </span>
                        )}
                      </h4>
                      {p.marca && <p className="text-[10px] text-outline dark:text-gray-500 font-bold uppercase tracking-widest leading-none mt-0.5">Marca: {p.marca}</p>}
                      <p className="text-[10px] text-outline dark:text-gray-500 font-bold uppercase tracking-widest leading-none">SKU: {p.sku}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${est.cls}`}>
                        {est.label.toUpperCase()}
                      </span>
                      <p className="text-secondary dark:text-[#e2bd6c] font-bold text-xs">${(p.precio || 0).toLocaleString('es-CL')}</p>
                    </div>
                    <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                  </div>

                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 pb-5 px-4' : 'max-h-0 opacity-0'}`}>
                    {p.variantes && p.variantes.length > 0 && (
                      <div className="mb-4 bg-surface-container/30 dark:bg-white/5 rounded-xl p-3 border border-outline-variant/10 dark:border-white/5">
                        <p className="text-[9px] font-bold text-outline-variant dark:text-gray-500 uppercase tracking-wider mb-2">Desglose por Variantes</p>
                        <div className="grid grid-cols-2 gap-2">
                          {p.variantes.map((v, i) => (
                            <div key={i} className="flex justify-between items-center bg-surface-container-low dark:bg-white/5 px-3 py-2 rounded-lg border border-outline-variant/5 dark:border-white/5">
                              <div className="flex items-center gap-1.5">
                                <div 
                                  className="w-2 h-2 rounded-full border border-black/10 dark:border-white/20"
                                  style={{ backgroundColor: getHexColor(v.nombre) || '#ccc' }}
                                />
                                <span className="text-[10px] font-bold text-on-surface dark:text-white/80 uppercase">{v.nombre}</span>
                              </div>
                              <span className="text-[10px] font-extrabold text-secondary dark:text-[#e2bd6c]">{v.stock} u.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10 dark:border-white/5">
                      <div className="space-y-4">
                        <p className="text-[9px] font-bold text-outline-variant dark:text-gray-500 uppercase tracking-wider">Detalles</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60 dark:text-[#e2bd6c]/60">store</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline dark:text-gray-600 leading-none">Proveedor</p>
                              <p className="text-[11px] font-bold text-on-surface dark:text-white/80">{(p.proveedor || 'S/P').toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60 dark:text-[#e2bd6c]/60">category</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline dark:text-gray-600 leading-none">Categoría</p>
                              <p className="text-[11px] font-bold text-on-surface dark:text-white/80">{(p.coleccion || '').toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60 dark:text-[#e2bd6c]/60">calendar_today</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline dark:text-gray-600 leading-none">Ingreso</p>
                              <p className="text-[11px] font-bold text-on-surface dark:text-white/80">{p.fechaIngreso || '-'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60 dark:text-[#e2bd6c]/60">payments</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline dark:text-gray-600 leading-none">Precio Costo / Venta</p>
                              <p className="text-[11px] font-bold text-on-surface dark:text-white/80">
                                ${(p.precioCosto || 0).toLocaleString('es-CL')} / ${(p.precio || 0).toLocaleString('es-CL')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60 dark:text-[#e2bd6c]/60">trending_up</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline dark:text-gray-600 leading-none">Ganancia (Margen)</p>
                              {(() => {
                                const ganancia = (p.precio || 0) - (p.precioCosto || 0);
                                const margen = p.precioCosto > 0 ? (ganancia / p.precioCosto) * 100 : 0;
                                const esPositiva = ganancia >= 0;
                                return (
                                  <p className={`text-[11px] font-bold ${esPositiva ? 'text-[#22c55e] dark:text-[#10b981]' : 'text-error'}`}>
                                    {esPositiva ? '+' : ''}${ganancia.toLocaleString('es-CL')} ({esPositiva ? '+' : ''}{margen.toFixed(1)}%)
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-outline-variant uppercase tracking-wider mb-2">Inventario</p>
                          <div className="flex items-end justify-between mb-1">
                            <p className={`text-base font-bold ${p.estado !== 'disponible' ? 'text-error' : 'text-primary'}`}>
                              {p.stock.toLocaleString()} <span className="text-[10px] font-medium opacity-70">u.</span>
                            </p>
                          </div>
                          <div className="w-full bg-outline-variant/20 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${p.estado === 'disponible' ? 'bg-primary' : 'bg-error/40 backdrop-blur-sm'}`}
                              style={{ width: `${porcBarra(p.stock)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                            className="flex-1 flex items-center justify-center gap-2 bg-surface-container-high border border-outline-variant/20 text-primary py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Editar
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                            className="flex-1 flex items-center justify-center gap-2 bg-error-container/20 border border-error/10 text-error py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Borrar
                          </button>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); openHistory(p.id); }}
                          className="w-full flex items-center justify-center gap-2 bg-secondary/10 border border-secondary/20 text-secondary dark:text-[#e2bd6c] py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-all mt-2"
                        >
                          <span className="material-symbols-outlined text-sm">history</span>
                          Historial de Stock
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-surface-container dark:bg-[#2a2a2a]">
                  {['', 'Producto', 'Proveedor', 'Categoría', 'Stock', 'P. Costo', 'P. Venta', 'Ganancia / Margen', 'Estado', 'Fecha Ingreso'].map((h, i) => (
                    <th key={i} className={`py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400 whitespace-nowrap ${i === 0 ? 'pl-8 w-20' : 'px-7'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 dark:divide-white/5">
                {paginatedProducts.map((p) => {
                  const est = estadoConfig[p.estado] || estadoConfig.disponible
                  return (
                    <tr key={p.id} className="hover:bg-surface-container-high dark:hover:bg-white/5 transition-colors group">
                      <td className="pl-8 py-5">
                        <div className="flex flex-col gap-2 transition-all duration-300">
                          <button onClick={() => openEdit(p)} className="text-outline/60 dark:text-gray-500 hover:text-primary dark:hover:text-[#e2bd6c] transition-colors" title="Editar">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </button>
                          <button onClick={() => openHistory(p.id)} className="text-outline/60 dark:text-gray-500 hover:text-secondary dark:hover:text-[#e2bd6c] transition-colors" title="Historial">
                            <span className="material-symbols-outlined text-[20px]">history</span>
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="text-outline/60 dark:text-gray-500 hover:text-error transition-colors" title="Eliminar">
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <div className="flex items-center gap-3">
                          {p.fotoUrl ? (
                            <img 
                              src={p.fotoUrl} 
                              alt={p.nombre} 
                              className="w-10 h-10 rounded-lg object-cover bg-surface-variant dark:bg-white/5 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity border border-outline-variant/10 dark:border-white/5" 
                              onClick={() => setExpandedImage(p.fotoUrl)}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-surface-variant dark:bg-white/5 flex items-center justify-center flex-shrink-0 border border-outline-variant/10 dark:border-white/5">
                              <span className="material-symbols-outlined text-outline dark:text-gray-500 text-lg">image</span>
                            </div>
                          )}
                          <div>
                            <p className="font-headline font-bold text-base text-on-surface dark:text-white/90 group-hover:text-primary dark:group-hover:text-[#e2bd6c] transition-colors flex items-center gap-2">
                              <span>{p.nombre}</span>
                              {p.visibleEnCatalogo === false && (
                                <span className="inline-flex items-center gap-1 text-[8px] bg-error-container/20 text-error px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-error/10">
                                  <span className="material-symbols-outlined text-[10px]">visibility_off</span>
                                  Oculto
                                </span>
                              )}
                            </p>
                            {p.marca && <p className="text-[10px] font-bold text-outline dark:text-gray-500 uppercase tracking-widest mt-0.5">Marca: {p.marca}</p>}
                            <p className="text-[10px] font-bold text-outline dark:text-gray-500 uppercase tracking-widest">Cód. Barra: {p.sku}</p>
                            {p.variantes && p.variantes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {p.variantes.map((v, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-[8px] bg-surface-variant dark:bg-white/5 px-1.5 py-0.5 rounded text-on-surface-variant dark:text-white/60 font-bold uppercase border border-outline-variant/5 dark:border-white/5">
                                    <div 
                                      className="w-1.5 h-1.5 rounded-full border border-black/5 dark:border-white/10"
                                      style={{ backgroundColor: getHexColor(v.nombre) || '#ccc' }}
                                    />
                                    {v.nombre} ({v.stock})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <span className="px-3 py-1 bg-surface-variant/40 dark:bg-white/5 text-on-surface-variant dark:text-white/60 text-[10px] font-bold uppercase rounded-full inline-block whitespace-nowrap text-center border border-outline-variant/10 dark:border-white/5">
                          {(p.proveedor || 'S/P').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        <span className="px-3 py-1 bg-surface-variant dark:bg-white/5 text-on-surface-variant dark:text-white/60 text-[10px] font-bold uppercase rounded-full inline-block whitespace-nowrap text-center border border-outline-variant/10 dark:border-white/5">
                          {(p.coleccion || '').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        <p className={`text-sm font-bold mb-1 ${p.estado !== 'disponible' ? 'text-error' : 'dark:text-[#e2bd6c]'}`}>
                          {p.stock.toLocaleString()} <span className="text-[10px] opacity-60">u.</span>
                        </p>
                        <div className="w-16 bg-outline-variant/20 dark:bg-white/10 h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.estado === 'disponible' ? 'bg-primary dark:bg-[#e2bd6c]' : 'bg-error'}`}
                            style={{ width: `${porcBarra(p.stock)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <p className="text-sm font-bold text-outline dark:text-gray-400">${(p.precioCosto || 0).toLocaleString('es-CL')}</p>
                      </td>
                      <td className="px-7 py-5">
                        <p className="text-sm font-bold text-secondary dark:text-[#e2bd6c]">${(p.precio || 0).toLocaleString('es-CL')}</p>
                      </td>
                      <td className="px-7 py-5">
                        {(() => {
                          const ganancia = (p.precio || 0) - (p.precioCosto || 0);
                          const margen = p.precioCosto > 0 ? (ganancia / p.precioCosto) * 100 : 0;
                          const esPositiva = ganancia >= 0;
                          return (
                            <div className="flex flex-col">
                              <p className={`text-sm font-bold ${esPositiva ? 'text-[#22c55e] dark:text-[#10b981]' : 'text-error'}`}>
                                {esPositiva ? '+' : ''}${ganancia.toLocaleString('es-CL')}
                              </p>
                              <p className={`text-[10px] font-bold ${esPositiva ? 'text-[#22c55e]/80 dark:text-[#10b981]/80' : 'text-error/80'}`}>
                                ({esPositiva ? '+' : ''}{margen.toFixed(1)}%)
                              </p>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-7 py-5">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-lg ${est.cls}`}>
                          {est.label.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        <span className="text-[10px] font-bold text-outline uppercase tracking-widest whitespace-nowrap">{p.fechaIngreso || '-'}</span>
                      </td>
                    </tr>

                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-7 py-12 text-center text-on-surface-variant text-sm">
                      No se encontraron productos. Crea uno nuevo usando el botón de arriba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 md:gap-4 py-8">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl border transition-all ${
                currentPage === 1
                  ? 'border-outline-variant/10 text-outline-variant/30 cursor-not-allowed opacity-50'
                  : 'border-outline-variant/30 text-primary dark:text-[#e2bd6c] hover:bg-surface-variant/30 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            
            <div className="flex items-center gap-1 md:gap-2">
              {[...Array(totalPages)].map((_, i) => {
                const pageNum = i + 1;
                // Lógica de visualización inteligente de páginas
                if (
                  totalPages > 5 &&
                  pageNum !== 1 &&
                  pageNum !== totalPages &&
                  Math.abs(pageNum - currentPage) > 1
                ) {
                  if (Math.abs(pageNum - currentPage) === 2) return <span key={pageNum} className="text-outline/40 px-1">...</span>;
                  return null;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl font-bold text-[10px] md:text-xs transition-all ${
                      currentPage === pageNum
                        ? 'bg-primary dark:bg-[#e2bd6c] text-white dark:text-black shadow-md scale-110'
                        : 'text-on-surface-variant dark:text-gray-400 hover:bg-surface-variant/30 dark:hover:bg-white/5'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl border transition-all ${
                currentPage === totalPages
                  ? 'border-outline-variant/10 text-outline-variant/30 cursor-not-allowed opacity-50'
                  : 'border-outline-variant/30 text-primary dark:text-[#e2bd6c] hover:bg-surface-variant/30 dark:hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {expandedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setExpandedImage(null)}>
          <div className="relative max-w-2xl w-full flex items-center justify-center">
            <button 
              onClick={() => setExpandedImage(null)} 
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
            <img 
              src={expandedImage} 
              alt="Vista ampliada" 
              className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()} 
            />
          </div>
        </div>
      )}

      {/* Modal CRUD (NUEVO / EDITAR) */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className={`bg-surface dark:bg-[#1e1e1e] w-full ${activeTabModal === 'catalogo' ? 'max-w-6xl' : 'max-w-4xl'} rounded-[40px] shadow-2xl border border-outline-variant/20 dark:border-white/5 flex flex-col max-h-[90vh] overflow-hidden text-on-surface dark:text-white/90 animate-in fade-in zoom-in-95 duration-300`}>
            {/* Header del Modal */}
            <div className="bg-surface-container-low dark:bg-white/5 px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-outline-variant/20 dark:border-white/5 shrink-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                <h3 className="font-headline font-bold text-xl text-primary dark:text-[#e2bd6c] flex items-center gap-2 shrink-0">
                  <span className="material-symbols-outlined">{editingId ? 'edit_square' : 'add_box'}</span>
                  {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                
                {/* Selector de pestañas deslizable premium / Luxe */}
                <div className="relative flex bg-surface-variant/30 dark:bg-white/5 p-1 rounded-2xl border border-outline-variant/10 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setActiveTabModal('editar')}
                    className={`relative z-10 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center gap-2 ${
                      activeTabModal === 'editar' 
                        ? 'text-primary dark:text-[#e2bd6c]' 
                        : 'text-outline/70 dark:text-white/50 hover:text-outline dark:hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">edit_note</span>
                    Editar Producto
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTabModal('catalogo')}
                    className={`relative z-10 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center gap-2 ${
                      activeTabModal === 'catalogo' 
                        ? 'text-primary dark:text-[#e2bd6c]' 
                        : 'text-outline/70 dark:text-white/50 hover:text-outline dark:hover:text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">visibility</span>
                    Editar en Catálogo
                  </button>
                  {/* Sliding pill background */}
                  <div 
                    className="absolute top-1 bottom-1 left-1 rounded-xl bg-[#E5E0D3]/80 dark:bg-white/10 transition-all duration-300 ease-out"
                    style={{
                      width: 'calc(50% - 6px)',
                      transform: activeTabModal === 'catalogo' ? 'translateX(100%)' : 'translateX(0%)',
                      border: '1px solid rgba(226, 189, 108, 0.2)'
                    }}
                  />
                </div>
              </div>
              
              <button 
                type="button"
                onClick={() => setShowModal(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-outline shrink-0 ml-auto sm:ml-0"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Cuerpo del Formulario (Scrollable) */}
            <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col">
              {errorMsg && (
                <div className="m-6 bg-error-container/20 text-error text-[11px] font-bold uppercase tracking-wider px-4 py-3 rounded-xl border border-error/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-1 shrink-0">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {activeTabModal === 'editar' ? (
                <div className="p-6 space-y-5">
                  {/* Fila 1: Nombre */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Nombre del Producto</label>
                    <input 
                      type="text" 
                      value={form.nombre} 
                      onChange={e => setForm({...form, nombre: e.target.value})}
                      className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm transition-all dark:text-white"
                      placeholder="Ej. Crema Collagen"
                    />
                  </div>

                  {/* Fila 2: Marca y SKU */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Marca</label>
                      <input 
                        type="text" 
                        value={form.marca} 
                        onChange={e => setForm({...form, marca: e.target.value})}
                        onFocus={() => setShowMarcaDropdown(true)}
                        className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm transition-all uppercase dark:text-white"
                        placeholder="BUSCAR MARCA..."
                      />
                      {showMarcaDropdown && (
                        <>
                          <div className="fixed inset-0 z-[110]" onClick={() => setShowMarcaDropdown(false)} />
                          <div className="absolute left-0 top-full mt-1 w-full bg-[#E5E0D3] dark:bg-[#2a2a2a] rounded-2xl shadow-2xl z-[120] py-2 border border-outline-variant/10 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                            <button 
                              type="button"
                              onClick={() => setShowMarcaDropdown(false)}
                              className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] dark:text-[#e2bd6c] flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                              <span className="text-lg font-bold">+</span> <span className="text-lg font-bold">+</span> AÑADIR NUEVA
                            </button>
                            {marcasUnicas
                              .filter(m => m.toLowerCase().includes((form.marca || '').toLowerCase()))
                              .slice(0, 3)
                              .map(m => (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => { setForm({...form, marca: m}); setShowMarcaDropdown(false); }}
                                  className="w-full text-left px-5 py-4 text-[13px] font-bold uppercase italic text-[#4A4A4A] dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-t border-black/10 dark:border-white/5"
                                >
                                  {m}
                                </button>
                              ))
                            }
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Código de Barra / SKU</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={form.sku} 
                          onChange={e => setForm({...form, sku: e.target.value})}
                          className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl pl-4 pr-14 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm transition-all dark:text-white"
                          placeholder="Escribe o escanea..."
                        />
                        <button 
                          type="button" 
                          onClick={() => setIsScanning(true)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary-container dark:bg-[#e2bd6c]/20 text-primary dark:text-[#e2bd6c] rounded-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Fila 3: Proveedor y Categoría */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Proveedor</label>
                      <input 
                        type="text" 
                        value={form.proveedor} 
                        onChange={e => setForm({...form, proveedor: e.target.value})}
                        onFocus={() => setShowProvDropdown(true)}
                        className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm uppercase dark:text-white"
                        placeholder="BUSCAR PROVEEDOR..."
                      />
                      {showProvDropdown && (
                        <>
                          <div className="fixed inset-0 z-[110]" onClick={() => setShowProvDropdown(false)} />
                          <div className="absolute left-0 top-full mt-1 w-full bg-[#E5E0D3] dark:bg-[#2a2a2a] rounded-2xl shadow-2xl z-[120] py-2 border border-outline-variant/10 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                            <button 
                              type="button"
                              onClick={() => setShowProvDropdown(false)}
                              className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] dark:text-[#e2bd6c] flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                              <span className="text-lg font-bold">+</span> <span className="text-lg font-bold">+</span> AÑADIR NUEVO
                            </button>
                            {proveedoresUnicos
                              .filter(p => p.toLowerCase().includes((form.proveedor || '').toLowerCase()))
                              .slice(0, 3)
                              .map(p => (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => { setForm({...form, proveedor: p}); setShowProvDropdown(false); }}
                                  className="w-full text-left px-5 py-4 text-[13px] font-bold uppercase italic text-[#4A4A4A] dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-t border-black/10 dark:border-white/5"
                                >
                                  {p}
                                </button>
                              ))
                            }
                          </div>
                        </>
                      )}
                    </div>

                    <div className="relative">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Categoría</label>
                      <input 
                        type="text" 
                        value={form.coleccion} 
                        onChange={e => setForm({...form, coleccion: e.target.value})}
                        onFocus={() => setShowCatDropdown(true)}
                        className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm uppercase dark:text-white"
                        placeholder="BUSCAR CATEGORÍA..."
                      />
                      {showCatDropdown && (
                        <>
                          <div className="fixed inset-0 z-[110]" onClick={() => setShowCatDropdown(false)} />
                          <div className="absolute left-0 top-full mt-1 w-full bg-[#E5E0D3] dark:bg-[#2a2a2a] rounded-2xl shadow-2xl z-[120] py-2 border border-outline-variant/10 dark:border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                            <button 
                              type="button"
                              onClick={() => setShowCatDropdown(false)}
                              className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] dark:text-[#e2bd6c] flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                              <span className="text-lg font-bold">+</span> <span className="text-lg font-bold">+</span> AÑADIR NUEVA
                            </button>
                            {categoriasUnicas
                              .filter(c => c.toLowerCase().includes((form.coleccion || '').toLowerCase()))
                              .slice(0, 3)
                              .map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => { setForm({...form, coleccion: c}); setShowCatDropdown(false); }}
                                  className="w-full text-left px-5 py-4 text-[13px] font-bold uppercase italic text-[#4A4A4A] dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-t border-black/10 dark:border-white/5"
                                >
                                  {c}
                                </button>
                              ))
                            }
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Fila 4: Precios y Stock */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Precio Costo ($)</label>
                      <input 
                        type="number" 
                        value={form.precioCosto} 
                        onChange={e => setForm({...form, precioCosto: e.target.value})}
                        className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Precio Venta ($)</label>
                      <input 
                        type="number" 
                        value={form.precio} 
                        onChange={e => setForm({...form, precio: e.target.value})}
                        className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">
                        {form.variantes?.length > 0 ? 'Stock Total' : (!editingId ? 'Stock Inicial' : 'Sumar / Restar Stock')}
                      </label>
                      {!editingId || form.variantes?.length > 0 ? (
                        <input 
                          type="number" 
                          value={form.variantes?.length > 0 ? form.variantes.reduce((sum, v) => sum + Number(v.stock), 0) : form.stock} 
                          onChange={e => setForm({...form, stock: e.target.value})}
                          readOnly={form.variantes?.length > 0}
                          className={`w-full border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white ${form.variantes?.length > 0 ? 'bg-surface-variant/30 dark:bg-white/5 text-outline dark:text-gray-500' : 'bg-surface-container-lowest dark:bg-white/5'}`}
                          placeholder="0"
                        />
                      ) : (
                        <div className="flex gap-2 h-[46px]">
                          <div className="flex-[2] relative h-full">
                            <input 
                              type="number" 
                              value={form.ajusteStock} 
                              onChange={e => setForm({...form, ajusteStock: e.target.value})}
                              className="w-full h-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white"
                              placeholder="Ej: 3 o -2"
                            />
                          </div>
                          <div className="flex-1 h-full bg-surface-variant/30 dark:bg-white/5 rounded-xl border border-outline-variant/20 dark:border-white/10 flex flex-col items-center justify-center leading-tight py-1">
                            <span className="text-[8px] font-bold uppercase text-outline">Stock Actual</span>
                            <span className="text-[13px] font-black text-on-surface dark:text-white">{form.stock}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GESTIÓN DE VARIANTES (Colores, Tallas, etc) */}
                  <div className="bg-surface-container/30 rounded-2xl p-4 border border-outline-variant/10 dark:border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary dark:text-[#e2bd6c]">diversity_2</span>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface dark:text-white/80">Variantes (Color, etc.)</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setForm({...form, variantes: [...(form.variantes || []), { nombre: '', stock: 0 }]})}
                        className="bg-secondary/10 dark:bg-white/10 text-secondary dark:text-[#e2bd6c] text-[9px] font-bold uppercase px-3 py-1.5 rounded-lg border border-secondary/20 dark:border-white/10 hover:bg-secondary/20 transition-all"
                      >
                        + Añadir
                      </button>
                    </div>

                    <div className="space-y-2">
                      {(form.variantes || []).map((variant, index) => (
                        <div key={index} className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                          <input 
                            type="text" 
                            value={variant.nombre}
                            onChange={e => {
                              const newV = [...form.variantes]
                              newV[index].nombre = e.target.value
                              setForm({...form, variantes: newV})
                            }}
                            className="flex-1 bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white"
                            placeholder="Ej. Verde"
                          />
                          <input 
                            type="number" 
                            value={variant.stock}
                            onChange={e => {
                              const newV = [...form.variantes]
                              newV[index].stock = e.target.value
                              setForm({...form, variantes: newV})
                            }}
                            className="w-20 bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl px-2 py-2.5 text-xs font-bold text-center focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white"
                            placeholder="0"
                          />
                          <button 
                            type="button"
                            onClick={() => setForm({...form, variantes: form.variantes.filter((_, i) => i !== index)})}
                            className="w-10 h-10 flex items-center justify-center text-error/60 hover:text-error hover:bg-error/5 rounded-xl transition-all"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      ))}
                      {(!form.variantes || form.variantes.length === 0) && (
                        <p className="text-[10px] text-outline/80 dark:text-gray-300 text-center py-2 italic font-semibold">
                          Ideal para productos con diferentes colores o tallas.
                        </p>
                      )}
                    </div>
                  </div>


                  {/* Fila 5: Otros */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1.5 ml-1">Fecha Ingreso</label>
                      <input 
                        type="date" 
                        value={form.fechaIngreso} 
                        onChange={e => setForm({...form, fechaIngreso: e.target.value})}
                        className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white"
                      />
                    </div>
                    <div className="col-span-2 bg-surface-container/30 rounded-2xl p-4 border border-outline-variant/10 dark:border-white/5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-primary dark:text-[#e2bd6c]">imagesmode</span>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface dark:text-white/80">Imágenes del Producto (Max 5)</p>
                        </div>
                        {(!form.fotos || form.fotos.length < 5) && (
                          <div className="flex gap-2">
                            <label className="bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] text-[9px] font-bold uppercase px-3 py-1.5 rounded-lg border border-primary/20 dark:border-[#e2bd6c]/20 hover:bg-primary/20 transition-all cursor-pointer flex items-center gap-1">
                              {isUploadingImage ? (
                                <span className="animate-pulse">Subiendo...</span>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[12px]">upload</span>
                                  Subir PC
                                </>
                              )}
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleImageUpload}
                                disabled={isUploadingImage}
                              />
                            </label>
                            <button 
                              type="button"
                              onClick={() => setForm({...form, fotos: [...(form.fotos || []), '']})}
                              className="bg-secondary/10 dark:bg-white/10 text-secondary dark:text-[#e2bd6c] text-[9px] font-bold uppercase px-3 py-1.5 rounded-lg border border-secondary/20 dark:border-white/10 hover:bg-secondary/20 transition-all flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[12px]">link</span>
                              URL
                            </button>
                          </div>
                        )}
                      </div>

                      <div 
                        className={`space-y-3 border-2 border-dashed rounded-xl p-3 transition-colors ${
                          isDragOver ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-transparent'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between bg-surface-container-low dark:bg-white/5 p-3 rounded-xl border border-outline-variant/30">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-outline/80 dark:text-gray-300">cloud_upload</span>
                            <span className="text-xs font-bold text-outline/90 dark:text-gray-300 uppercase tracking-wider">Arrastra imágenes aquí</span>
                          </div>
                          <div className="flex gap-4 items-center">
                            <label className="text-[10px] font-bold text-primary dark:text-[#e2bd6c] underline cursor-pointer hover:text-primary/80 transition-colors">
                              {isUploadingImage ? uploadProgress : 'Seleccionar Múltiples'}
                              <input type="file" accept="image/*" multiple className="hidden" onChange={onFileInputChange} disabled={isUploadingImage} />
                            </label>
                            <button 
                              type="button"
                              onClick={() => setForm({...form, fotos: [...(form.fotos || []), '']})}
                              className="text-[10px] font-bold text-secondary dark:text-gray-400 underline hover:text-secondary/80 transition-colors"
                            >
                              Añadir URL Vacía
                            </button>
                          </div>
                        </div>

                        {(form.fotos || []).map((url, index) => (
                          <div key={index} className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="w-8 h-8 rounded-lg bg-surface-container dark:bg-white/10 flex flex-col items-center justify-center shrink-0 border border-outline-variant/20 overflow-hidden">
                              <button 
                                type="button"
                                onClick={() => {
                                  if (index > 0) {
                                    const newFotos = [...form.fotos];
                                    [newFotos[index - 1], newFotos[index]] = [newFotos[index], newFotos[index - 1]];
                                    setForm({...form, fotos: newFotos});
                                  }
                                }}
                                disabled={index === 0}
                                className={`w-full flex-1 flex items-center justify-center hover:bg-surface-variant dark:hover:bg-white/20 transition-colors ${index === 0 ? 'opacity-30 cursor-not-allowed' : 'text-primary dark:text-[#e2bd6c]'}`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">expand_less</span>
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  if (index < form.fotos.length - 1) {
                                    const newFotos = [...form.fotos];
                                    [newFotos[index], newFotos[index + 1]] = [newFotos[index + 1], newFotos[index]];
                                    setForm({...form, fotos: newFotos});
                                  }
                                }}
                                disabled={index === form.fotos.length - 1}
                                className={`w-full flex-1 flex items-center justify-center hover:bg-surface-variant dark:hover:bg-white/20 transition-colors ${index === form.fotos.length - 1 ? 'opacity-30 cursor-not-allowed' : 'text-primary dark:text-[#e2bd6c]'}`}
                              >
                                <span className="material-symbols-outlined text-[12px] leading-none">expand_more</span>
                              </button>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => url && setPreviewImage(url)} 
                              className="w-10 h-10 shrink-0 rounded-lg overflow-hidden border border-outline-variant/20 dark:border-white/10 hover:border-primary dark:hover:border-[#e2bd6c] transition-colors bg-surface-variant/30 flex items-center justify-center group relative cursor-zoom-in"
                            >
                              {url ? (
                                <>
                                  <img src={url} alt={`Imagen ${index + 1}`} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-[16px]">zoom_in</span>
                                  </div>
                                </>
                              ) : (
                                <span className="material-symbols-outlined text-outline/50 text-[16px]">image</span>
                              )}
                            </button>
                            <input 
                              type="url" 
                              value={url}
                              onChange={e => {
                                const newFotos = [...form.fotos]
                                newFotos[index] = e.target.value
                                setForm({...form, fotos: newFotos})
                              }}
                              className="flex-1 bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white"
                              placeholder="https://url-de-la-imagen.jpg"
                            />
                            <button 
                              type="button"
                              onClick={() => setForm({...form, fotos: form.fotos.filter((_, i) => i !== index)})}
                              className="w-10 h-10 flex items-center justify-center text-error/60 hover:text-error hover:bg-error/5 rounded-xl transition-all"
                            >
                              <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          </div>
                        ))}
                        {(!form.fotos || form.fotos.length === 0) && (
                          <div className="text-center py-6">
                            <p className="text-[10px] text-outline italic font-medium opacity-60">
                              Puedes subir o arrastrar hasta 5 imágenes.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* activeTabModal === 'catalogo' */
                <div className="p-6 bg-surface-variant/10 dark:bg-black/10 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* Columna Izquierda: Editor de Descripción Avanzado (5 de 12 columnas) */}
                    <div className="lg:col-span-5 flex flex-col gap-4 bg-surface dark:bg-[#1a1a1a] p-5 rounded-[28px] border border-outline-variant/20 dark:border-white/5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black uppercase tracking-widest text-[#8B7355] dark:text-[#e2bd6c]">
                          Editor de Descripción
                        </label>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-outline/80 dark:text-white/40 uppercase tracking-wider">
                            caracteres: {form.descripcion?.length || 0} | palabras: {form.descripcion ? form.descripcion.trim().split(/\s+/).filter(Boolean).length : 0}
                          </span>
                          <button
                            type="button"
                            onClick={clearDescription}
                            title="Limpiar toda la descripción"
                            className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-error/10 text-error hover:bg-error/20 border border-error/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1 shrink-0 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[11px]">delete_sweep</span>
                            Limpiar
                          </button>
                        </div>
                      </div>

                      {/* Barra de herramientas */}
                      <div className="flex flex-wrap gap-1.5 p-2 bg-surface-container-low dark:bg-black/25 rounded-2xl border border-outline-variant/15 dark:border-white/5">
                        <button
                          type="button"
                          onClick={autoFillWithAI}
                          disabled={isGeneratingAI}
                          title="Rellenar información automáticamente con IA usando el nombre y fotos"
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 dark:hover:bg-purple-500/30 border border-purple-500/20 dark:border-purple-500/30 transition-all flex items-center gap-1 hover:scale-105 active:scale-95 disabled:opacity-40 shadow-sm shrink-0"
                        >
                          <span className={`material-symbols-outlined text-[12px] ${isGeneratingAI ? 'animate-spin' : 'animate-pulse'}`}>
                            {isGeneratingAI ? 'progress_activity' : 'psychology'}
                          </span>
                          {isGeneratingAI ? 'Generando...' : 'Generar con IA'}
                        </button>

                        <button
                          type="button"
                          onClick={() => insertTextIntoDescription(plantillaCosmetica)}
                          title="Insertar plantilla estética premium"
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] hover:bg-[#e2bd6c]/20 border border-[#e2bd6c]/20 transition-all flex items-center gap-1 hover:scale-105 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                          Plantilla
                        </button>
                        
                        <button
                          type="button"
                          onClick={insertNumberedHeader}
                          title="Añadir título auto-numerado"
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#8B7355]/10 text-[#8B7355] dark:text-[#e2bd6c]/90 hover:bg-[#8B7355]/20 dark:hover:bg-white/10 border border-[#8B7355]/20 dark:border-white/5 transition-all flex items-center gap-1 hover:scale-105 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[12px]">format_list_numbered</span>
                          Título Auto
                        </button>

                        <button
                          type="button"
                          onClick={insertBullet}
                          title="Insertar viñeta elegante"
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#8B7355]/10 text-[#8B7355] dark:text-[#e2bd6c]/90 hover:bg-[#8B7355]/20 dark:hover:bg-white/10 border border-[#8B7355]/20 dark:border-white/5 transition-all flex items-center gap-1 hover:scale-105 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[12px]">format_list_bulleted</span>
                          Viñeta
                        </button>

                        <button
                          type="button"
                          onClick={insertNumberedList}
                          title="Insertar lista numerada premium"
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] hover:bg-[#e2bd6c]/20 border border-[#e2bd6c]/20 transition-all flex items-center gap-1 hover:scale-105 active:scale-95 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[12px]">123</span>
                          Números
                        </button>

                        <button
                          type="button"
                          onClick={insertBold}
                          title="Poner en negrita"
                          className="px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-[#8B7355]/10 text-[#8B7355] dark:text-[#e2bd6c]/90 hover:bg-[#8B7355]/20 dark:hover:bg-white/10 border border-[#8B7355]/20 dark:border-white/5 transition-all flex items-center gap-1 hover:scale-105 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[12px]">format_bold</span>
                          Negrita
                        </button>
                      </div>

                      {/* Bandeja de emojis */}
                      <div className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-low dark:bg-white/5 rounded-xl border border-outline-variant/10 dark:border-white/5 overflow-x-auto custom-scrollbar">
                        <span className="text-[9px] font-black uppercase tracking-widest text-outline/60 dark:text-white/40 shrink-0">Emojis:</span>
                        {['✨', '🧴', '💆‍♀️', '🌸', '🌿', '🧪', '💧', '💄', '☀️', '🌙'].map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertTextIntoDescription(emoji)}
                            className="w-7 h-7 flex items-center justify-center text-sm rounded-lg hover:bg-[#e2bd6c]/15 hover:scale-115 active:scale-95 transition-all shrink-0"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {/* Textarea del editor */}
                      <textarea
                        ref={descriptionTextareaRef}
                        value={form.descripcion}
                        onChange={e => setForm({...form, descripcion: e.target.value})}
                        placeholder="Escribe la descripción premium aquí..."
                        className="w-full bg-surface-container-lowest dark:bg-black/35 border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-4 text-sm focus:outline-none focus:border-[#e2bd6c] font-medium shadow-inner transition-all dark:text-white min-h-[350px] lg:min-h-[400px] resize-none leading-relaxed custom-scrollbar"
                      />
                    </div>

                    {/* Columna Derecha: Vista Previa en Catálogo Real-Time (7 de 12 columnas) */}
                    <div className="lg:col-span-7 flex flex-col">
                      {/* Live Catalog Preview Container */}
                      <div className="flex flex-col h-full rounded-[32px] overflow-hidden border border-outline-variant/30 dark:border-white/10 bg-[#fdfcf7] dark:bg-[#121212] shadow-2xl text-on-surface dark:text-white/90">
                        
                        {/* Preview Header Banner */}
                        <div className="bg-[#e2bd6c]/10 dark:bg-[#e2bd6c]/5 border-b border-[#e2bd6c]/20 px-5 py-3 flex items-center justify-between shrink-0">
                          <span className="text-[10px] font-black tracking-widest text-[#8B7355] dark:text-[#e2bd6c] uppercase flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm animate-pulse">visibility</span>
                            Vista de Catálogo (En Vivo)
                          </span>
                          <span className="text-[9px] font-bold text-outline/60 dark:text-white/40 uppercase tracking-widest">
                            Réplica de Catálogo Público
                          </span>
                        </div>

                        {/* Simulated catalog detail view */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-outline-variant/15 dark:divide-white/5">
                          
                          {/* GALLERY SECTION (left column of catalog detail) */}
                          <div className="w-full md:w-[45%] flex flex-col relative select-none bg-surface-container-lowest dark:bg-[#161616] p-4">
                            {/* Backdrop blur */}
                            {form.fotos && form.fotos[previewImageIndex < (form.fotos?.length || 0) ? previewImageIndex : 0] && (
                              <div 
                                className="absolute inset-0 z-0 bg-cover bg-center filter blur-3xl opacity-25 scale-125 transition-all duration-500 pointer-events-none"
                                style={{ backgroundImage: `url(${form.fotos[previewImageIndex < (form.fotos?.length || 0) ? previewImageIndex : 0]})` }}
                              />
                            )}

                            <div className="relative z-10 flex-1 flex items-center justify-center min-h-[220px] md:min-h-[280px] max-h-[320px] rounded-2xl overflow-hidden bg-black/5 dark:bg-black/25 border border-outline-variant/10 dark:border-white/5">
                              {form.fotos && form.fotos[previewImageIndex < (form.fotos?.length || 0) ? previewImageIndex : 0] ? (
                                <img 
                                  src={form.fotos[previewImageIndex < (form.fotos?.length || 0) ? previewImageIndex : 0]} 
                                  alt={form.nombre}
                                  className="max-w-full max-h-full object-contain rounded-xl shadow-md p-2 hover:scale-105 transition-transform duration-500"
                                />
                              ) : (
                                <div className="flex flex-col items-center justify-center p-6 text-center text-outline/40 dark:text-white/20">
                                  <span className="material-symbols-outlined text-5xl mb-2">image_not_supported</span>
                                  <span className="text-xs font-bold uppercase tracking-wider">Sin Imagen Cargada</span>
                                </div>
                              )}

                              {/* Gallery navigation controls */}
                              {form.fotos && form.fotos.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImageIndex(prev => (prev > 0 ? prev - 1 : form.fotos.length - 1))}
                                    className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                                      isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant shadow-md'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-base">chevron_left</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImageIndex(prev => (prev < form.fotos.length - 1 ? prev + 1 : 0))}
                                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                                      isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant shadow-md'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-base">chevron_right</span>
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Thumbnail carousel */}
                            {form.fotos && form.fotos.length > 1 && (
                              <div className="flex gap-1.5 mt-3 justify-center overflow-x-auto max-w-full py-1.5 shrink-0 select-none custom-scrollbar">
                                {form.fotos.map((f, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => setPreviewImageIndex(i)}
                                    className={`w-9 h-9 rounded-lg border overflow-hidden transition-all shrink-0 p-0.5 bg-surface dark:bg-[#1a1a1a] ${
                                      previewImageIndex === i 
                                        ? (isDark ? 'border-[#e2bd6c] scale-105' : 'border-primary scale-105') 
                                        : (isDark ? 'border-white/10 opacity-60 hover:opacity-100' : 'border-outline-variant/20 opacity-60 hover:opacity-100')
                                    }`}
                                  >
                                    <img src={f || 'https://via.placeholder.com/80'} className="w-full h-full object-cover rounded-md" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* PRODUCT INFO & DETAILS (right column of catalog detail) */}
                          <div className="w-full md:w-[55%] flex flex-col p-5 space-y-5 bg-surface dark:bg-[#121212]">
                            
                            {/* Name and brand header */}
                            <div className="text-center md:text-left">
                              <h2 className={`font-headline font-black text-lg md:text-xl leading-snug mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                {form.nombre || 'Nombre del Producto Mockup'}
                              </h2>
                              <p className={`text-[9px] font-bold uppercase tracking-[0.2em] opacity-60 mb-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'}`}>
                                {(form.coleccion || 'SIN CATEGORÍA').toUpperCase()}
                              </p>

                              <div className="flex items-center gap-3 justify-center md:justify-start">
                                <div className={`h-[1px] flex-1 max-w-[20px] bg-gradient-to-r ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                                <p className={`text-[9px] font-extrabold uppercase tracking-[0.3em] ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
                                  {form.marca || 'GENÉRICO'}
                                </p>
                                <div className={`h-[1px] flex-1 max-w-[20px] bg-gradient-to-l ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                              </div>
                            </div>

                            {/* Description section */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-sm ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>description</span>
                                <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                                  Descripción Detallada
                                </p>
                              </div>

                              <div className="max-h-[220px] md:max-h-[250px] overflow-y-auto custom-scrollbar pr-1.5">
                                {form.descripcion ? (
                                  <div className="space-y-4">
                                    {(() => {
                                      const renderContent = (txt) => {
                                        if (!txt.includes('**')) return txt;
                                        const parts = txt.split(/(\*\*.*?\*\*)/g);
                                        return parts.map((part, i) => {
                                          if (part.startsWith('**') && part.endsWith('**')) {
                                            const cleanText = part.slice(2, -2);
                                            return (
                                              <strong
                                                key={i}
                                                className={`font-black tracking-wide ${
                                                  isDark ? 'text-[#e2bd6c]' : 'text-primary'
                                                }`}
                                              >
                                                {cleanText}
                                              </strong>
                                            );
                                          }
                                          return part;
                                        });
                                      };

                                      const lineas = form.descripcion.split('\n');
                                      const secciones = [];
                                      let seccionActual = { title: '', contentLines: [] };

                                      lineas.forEach(linea => {
                                        const trimmed = linea.trim();
                                        if (trimmed === '') {
                                          if (seccionActual.contentLines.length > 0 || seccionActual.title) {
                                            seccionActual.contentLines.push(linea);
                                          }
                                          return;
                                        }

                                        const esTituloStars = trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length >= 4;
                                        const esTituloNumber = /^\d+\./.test(trimmed) && trimmed.length <= 35;
                                        const esTitulo = esTituloStars || esTituloNumber;

                                        if (esTitulo) {
                                          if (seccionActual.title || seccionActual.contentLines.length > 0) {
                                            secciones.push(seccionActual);
                                          }

                                          let cleanTitle = linea;
                                          if (esTituloStars) {
                                            const startIdx = linea.indexOf('**');
                                            const endIdx = linea.lastIndexOf('**');
                                            cleanTitle = linea.substring(0, startIdx) + linea.substring(startIdx + 2, endIdx) + linea.substring(endIdx + 2);
                                          }

                                          seccionActual = { title: cleanTitle, contentLines: [] };
                                        } else {
                                          seccionActual.contentLines.push(linea);
                                        }
                                      });

                                      if (seccionActual.title || seccionActual.contentLines.length > 0) {
                                        secciones.push(seccionActual);
                                      }

                                      return secciones.map((seccion, idx) => {
                                        const hasTitle = seccion.title.trim().length > 0;
                                        const matchNum = seccion.title.trim().match(/^(\d+)\s*[\.\-]?\s*(.*)$/);

                                        let titleNode = null;
                                        if (hasTitle) {
                                          if (matchNum) {
                                            const num = matchNum[1];
                                            const textTitle = matchNum[2];
                                            titleNode = (
                                              <div className="flex items-center gap-2 mb-2">
                                                <span className="w-5 h-5 flex items-center justify-center text-[9px] font-black bg-[#e2bd6c]/15 text-[#e2bd6c] border border-[#e2bd6c]/30 rounded-full shrink-0 shadow-sm">
                                                  {num}
                                                </span>
                                                <h4 className={`text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                                  {renderContent(textTitle)}
                                                </h4>
                                              </div>
                                            );
                                          } else {
                                            titleNode = (
                                              <div className="flex items-center gap-2 mb-2 border-l-2 border-[#e2bd6c] pl-2">
                                                <h4 className={`text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                                  {renderContent(seccion.title)}
                                                </h4>
                                              </div>
                                            );
                                          }
                                        }

                                        return (
                                          <div
                                            key={idx}
                                            className={`backdrop-blur-sm p-4 rounded-[20px] border shadow-sm transition-all duration-300 ${
                                              isDark
                                                ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5'
                                                : 'bg-black/[0.01] hover:bg-black/[0.03] border-outline-variant/10 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)]'
                                            }`}
                                          >
                                            {titleNode}
                                            <div className="space-y-1.5 leading-relaxed">
                                              {seccion.contentLines.map((line, lIdx) => {
                                                const trimmedLine = line.trim();
                                                if (trimmedLine === '') return <div key={lIdx} className="h-1.5" />;
                                                
                                                const esViñeta = trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*');
                                                if (esViñeta) {
                                                  const cleanLine = trimmedLine.replace(/^[•\-*]\s*/, '');
                                                  return (
                                                    <div key={lIdx} className="flex items-start gap-1.5 text-[11px]">
                                                      <span className="text-[#e2bd6c] font-black select-none mt-0.5">•</span>
                                                      <p className={`${isDark ? 'text-white/80 font-normal opacity-90' : 'text-on-surface-variant font-normal opacity-90'} flex-1`}>
                                                        {renderContent(cleanLine)}
                                                      </p>
                                                    </div>
                                                  );
                                                }

                                                const matchNumero = trimmedLine.match(/^(\d+)(?:\.|\-|\.\-|\-\.|\s)*\s+(.*)$/);
                                                if (matchNumero) {
                                                  const num = matchNumero[1];
                                                  const cleanLine = matchNumero[2];
                                                  return (
                                                    <div key={lIdx} className="flex items-start gap-2 text-[11px] py-0.5">
                                                      <span className="text-[#e2bd6c] font-black select-none shrink-0">{num}.</span>
                                                      <p className={`flex-1 font-semibold ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                                        {renderContent(cleanLine)}
                                                      </p>
                                                    </div>
                                                  );
                                                }

                                                return (
                                                  <p
                                                    key={lIdx}
                                                    className={`text-[11px] ${
                                                      isDark ? 'text-white/80 font-normal opacity-90' : 'text-on-surface-variant font-normal opacity-90'
                                                    }`}
                                                  >
                                                    {renderContent(line)}
                                                  </p>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                ) : (
                                  <div className={`backdrop-blur-sm p-6 rounded-[20px] border shadow-inner text-center space-y-2 text-outline/50 dark:text-white/20 ${
                                    isDark ? 'bg-white/5 border-white/5' : 'bg-white/50 border-outline-variant/10'
                                  }`}>
                                    <span className="material-symbols-outlined text-2xl">info</span>
                                    <p className="text-[10px] italic">
                                      Escribe en el editor para ver cómo se resalta y organiza tu descripción en tiempo real.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Stock status card */}
                            <div className={`p-3 rounded-2xl border relative overflow-hidden group shadow-sm ${
                              isDark ? 'bg-white/0 border-white/5' : 'bg-gradient-to-br from-white to-[#f9f9f9] border-outline-variant/10'
                            }`}>
                              <div className="absolute top-0 right-0 p-3 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-500">
                                <span className="material-symbols-outlined text-5xl transform rotate-12">inventory_2</span>
                              </div>
                              <div className="flex items-center gap-3 relative z-10">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c]' : 'bg-secondary/5 text-secondary'
                                }`}>
                                  <span className="material-symbols-outlined text-xl">inventory_2</span>
                                </div>
                                <div>
                                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-outline/80 mb-0.5">
                                    Disponibilidad en Bodega
                                  </p>
                                  <p className={`text-xs md:text-sm font-black ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                    {form.variantes?.length > 0 
                                      ? `${form.variantes.reduce((sum, v) => sum + Number(v.stock), 0)} UNIDADES`
                                      : `${form.stock || 0} UNIDADES`}
                                  </p>
                                </div>
                              </div>
                            </div>

                          </div>

                        </div>

                        {/* Price & Action mockup footer bar */}
                        <div className={`p-4 border-t shrink-0 ${isDark ? 'bg-[#121212]/95 border-white/5' : 'bg-white/95 border-outline-variant/10'}`}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="shrink-0 text-left">
                              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-outline/80 mb-0.5">
                                Precio Internet
                              </p>
                              <div className="flex items-baseline gap-0.5">
                                <span className={`text-xs font-light ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>$</span>
                                <p className={`font-black text-xl md:text-2xl tracking-tighter ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                                  {(Number(form.precio) || 0).toLocaleString('es-CL')}
                                </p>
                              </div>
                            </div>

                            <div className={`flex-1 py-3 px-4 rounded-xl font-black uppercase tracking-[0.15em] text-[9px] text-center shadow-md flex justify-center items-center gap-2 cursor-default select-none ${
                              isDark ? 'bg-[#e2bd6c] text-black' : 'bg-primary text-on-primary'
                            }`}>
                              <span className="material-symbols-outlined text-base">shopping_cart_checkout</span>
                              <span>Añadir al Pedido</span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="bg-surface-container-low dark:bg-white/5 px-6 py-4 border-t border-outline-variant/20 dark:border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
              {/* Toggle de visibilidad en catálogo */}
              <div className="w-full sm:w-auto flex justify-start">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, visibleEnCatalogo: !form.visibleEnCatalogo })}
                  className="flex items-center gap-3 group focus:outline-none cursor-pointer"
                >
                  {/* The Toggle Track */}
                  <div className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                    form.visibleEnCatalogo !== false 
                      ? 'bg-[#e2bd6c]' 
                      : 'bg-outline-variant/30 dark:bg-white/10'
                  } border border-outline-variant/20 dark:border-white/5`}>
                    {/* The Thumb */}
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#1e1e1e] shadow-md transition-transform duration-300 ${
                      form.visibleEnCatalogo !== false 
                        ? 'translate-x-6 bg-white dark:bg-white' 
                        : 'translate-x-0'
                    } flex items-center justify-center`}>
                      <span className={`material-symbols-outlined text-[10px] font-bold ${
                        form.visibleEnCatalogo !== false ? 'text-[#e2bd6c]' : 'text-outline/40'
                      }`}>
                        {form.visibleEnCatalogo !== false ? 'visibility' : 'visibility_off'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Label */}
                  <div className="flex flex-col items-start text-left">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 leading-none">
                      Visible en Catálogo
                    </span>
                    <span className="text-[10px] text-outline/70 dark:text-white/40 mt-0.5">
                      {form.visibleEnCatalogo !== false 
                        ? 'El producto aparecerá en el catálogo' 
                        : 'Oculto en el catálogo público'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Botones de Acción */}
              <div className="flex gap-3 w-full sm:w-auto sm:min-w-[280px]">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest text-on-surface-variant dark:text-white/60 hover:bg-surface-variant dark:hover:bg-white/5 transition-all active:scale-95 border border-outline-variant/10 dark:border-white/5"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleSave}
                  className="flex-[2] py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest bg-primary text-on-primary shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">{editingId ? 'save' : 'add_circle'}</span>
                  {editingId ? 'Guardar Cambios' : 'Registrar Producto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visor de Escaneo de Cámara */}
      {isScanning && (
        <BarcodeScanner 
          onScan={(decodedText) => {
            setForm({ ...form, sku: decodedText })
            setIsScanning(false)
            // Pequeña notificación web nativa si soporta vibración
            if (window.navigator?.vibrate) window.navigator.vibrate(200)
          }}
          onClose={() => setIsScanning(false)}
        />
      )}
      {/* Modal Historial de Stock */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in" onClick={() => setShowHistoryModal(false)} />
          <div className="bg-surface dark:bg-[#1a1a1a] rounded-[24px] shadow-2xl w-full max-w-lg relative z-10 flex flex-col animate-in slide-in-from-bottom-4 duration-300 border border-outline-variant/20 dark:border-white/10 max-h-[85vh]">
            <div className="p-6 border-b border-outline-variant/20 dark:border-white/10 flex justify-between items-center bg-surface-container-low dark:bg-white/5 rounded-t-[24px] shrink-0">
              <div>
                <h3 className="font-headline text-xl text-secondary dark:text-[#e2bd6c] font-bold italic leading-tight">Historial de Stock</h3>
                <p className="text-[10px] uppercase tracking-widest text-outline dark:text-gray-400 font-bold mt-1">
                  Movimientos Registrados
                </p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-variant dark:bg-white/10 dark:hover:bg-white/20 text-on-surface dark:text-white transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {isHistoryLoading ? (
                <div className="text-center py-10 text-outline animate-pulse text-sm font-medium">Cargando historial...</div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-4xl text-outline/30 mb-2">history_toggle_off</span>
                  <p className="text-outline text-sm font-medium">No hay registros de movimientos para este producto.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyLogs.map(log => {
                    const date = new Date(log.fecha)
                    const isPositive = log.cambio > 0
                    const isCreation = log.accion === 'Creación inicial'
                    return (
                      <div key={log.id} className="bg-surface-container-low dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl p-4 flex gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isCreation ? 'bg-secondary/10 text-secondary dark:text-[#e2bd6c]' : isPositive ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                          <span className="material-symbols-outlined text-lg">{isCreation ? 'inventory_2' : isPositive ? 'add' : 'remove'}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-outline dark:text-gray-500 font-bold tracking-widest uppercase mb-1">
                            {date.toLocaleDateString('es-CL')} a las {date.toLocaleTimeString('es-CL', {hour: '2-digit', minute: '2-digit'})}
                          </p>
                          <h4 className="text-sm font-bold text-on-surface dark:text-white mb-1">{log.accion}</h4>
                          <p className="text-xs text-outline-variant dark:text-gray-400">{log.motivo}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-base font-bold ${isCreation ? 'text-secondary dark:text-[#e2bd6c]' : isPositive ? 'text-primary' : 'text-error'}`}>
                            {isPositive ? '+' : ''}{log.cambio}
                          </p>
                          <p className="text-[10px] text-outline font-bold mt-1">Stock: {log.stockNuevo}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal para configurar la API Key de Gemini */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in" onClick={() => setShowApiKeyModal(false)} />
          <div className="bg-surface dark:bg-[#1a1a1a] rounded-[28px] shadow-2xl w-full max-w-md relative z-10 flex flex-col animate-in zoom-in-95 duration-300 border border-outline-variant/20 dark:border-white/10 p-6 text-on-surface dark:text-white/90">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-300 rounded-2xl flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl animate-pulse">psychology</span>
              </div>
              <div>
                <h3 className="font-headline text-lg font-bold text-secondary dark:text-[#e2bd6c] leading-tight">Configurar IA de Gemini</h3>
                <p className="text-[9px] uppercase tracking-widest text-outline dark:text-gray-400 font-bold mt-1">Generación Inteligente de Contenido</p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant dark:text-gray-300 leading-relaxed mb-4">
              Para rellenar descripciones automáticamente y analizar imágenes de producto, necesitamos conectarnos a Google Gemini API. 
              <br /><br />
              Puedes obtener una <strong>API Key gratis</strong> al instante en <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary dark:text-[#e2bd6c] underline hover:opacity-80 transition-opacity">Google AI Studio</a>. Esta clave se guardará de forma 100% segura únicamente en tu navegador.
            </p>

            <div className="space-y-4 mb-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Gemini API Key</label>
                <input 
                  type="password"
                  className="w-full bg-surface-container-lowest dark:bg-[#121212] border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white"
                  placeholder="AIzaSy..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="flex-1 py-3 bg-surface-variant/30 text-outline hover:bg-surface-variant/50 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => {
                  if (tempApiKey.trim()) {
                    localStorage.setItem('gemini_api_key', tempApiKey.trim());
                    setShowApiKeyModal(false);
                    autoFillWithAI();
                  }
                }}
                disabled={!tempApiKey.trim()}
                className="flex-1 py-3 bg-purple-600 dark:bg-[#e2bd6c] text-white dark:text-black rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
              >
                Guardar y Generar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  )
}
