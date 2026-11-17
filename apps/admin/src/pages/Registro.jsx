// src/pages/Registro.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getLocalDateString, formatDateDMA } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import Footer from '../components/Footer';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MEDIOS_PAGO = [
  { id: 'credito', label: 'Tarjeta de Crédito', icon: 'credit_card' },
  { id: 'debito', label: 'Tarjeta de Débito', icon: 'account_balance' }
];

const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const CATEGORIAS_GASTOS_OP = [
  { id: 'transporte', label: 'Pasajes / Transporte', icon: 'directions_bus' },
  { id: 'comida', label: 'Comida / Alimentación', icon: 'restaurant' },
  { id: 'otros', label: 'Otros / Gastos Varios', icon: 'payments' }
];

// Calcula el siguiente número correlativo disponible ("Registro X") restaurando huecos de IDs eliminados
function calcularSiguienteNumeroRegistro(registrosActuales) {
  const numerosOcupados = new Set();
  (registrosActuales || []).forEach(r => {
    if (r.numeroRegistro && Number(r.numeroRegistro) > 0) {
      numerosOcupados.add(Number(r.numeroRegistro));
    } else if (r.numeroBoleta && Number(r.numeroBoleta) > 0) {
      numerosOcupados.add(Number(r.numeroBoleta));
    } else {
      const nom = String(r.nombreRegistro || r.nombreBoleta || '');
      const match = nom.match(/(?:Registro|Boleta)\s+(\d+)/i);
      if (match) numerosOcupados.add(Number(match[1]));
    }
  });

  let nextNum = 1;
  while (numerosOcupados.has(nextNum)) {
    nextNum++;
  }
  return nextNum;
}

function generarCuotasCalculadas(total, numCuotas, diaPago, mesInicio) {
  const tot = Number(total) || 0;
  const nCuotas = Math.max(1, parseInt(numCuotas) || 1);
  const dia = Math.min(31, Math.max(1, parseInt(diaPago) || 5));
  
  let [year, month] = (mesInicio || getLocalDateString().slice(0, 7)).split('-').map(Number);
  
  const cuotaBase = Math.floor(tot / nCuotas);
  const residuo = tot - (cuotaBase * nCuotas);
  
  const cuotas = [];
  for (let i = 0; i < nCuotas; i++) {
    let m = month - 1 + i;
    let y = year + Math.floor(m / 12);
    let mesIndex = ((m % 12) + 12) % 12;
    
    const diasEnMes = new Date(y, mesIndex + 1, 0).getDate();
    const diaReal = Math.min(dia, diasEnMes);
    
    const fechaISO = `${y}-${String(mesIndex + 1).padStart(2, '0')}-${String(diaReal).padStart(2, '0')}`;
    const fechaLabel = `${diaReal} de ${MESES_ABR[mesIndex]}`;
    
    const valorCuota = i === 0 ? (cuotaBase + residuo) : cuotaBase;
    
    cuotas.push({
      numero: i + 1,
      fecha: fechaISO,
      fechaLabel,
      monto: valorCuota,
      pagada: false
    });
  }
  return cuotas;
}

export default function Registro() {
  const { operatorName } = useAuth() || {};
  const currentOperator = operatorName || 'Por sistema';

  // Selector de módulo: Boletas o Gastos Operativos
  const [tabPrincipal, setTabPrincipal] = useState('boletas'); // 'boletas' | 'gastos'
  const [gastosOperativosList, setGastosOperativosList] = useState([]);
  const [showModalGasto, setShowModalGasto] = useState(false);
  const [gastoForm, setGastoForm] = useState({
    categoria: 'transporte',
    monto: '',
    fecha: getLocalDateString(),
    descripcion: ''
  });
  const [savingGasto, setSavingGasto] = useState(false);
  const [gastoAEliminar, setGastoAEliminar] = useState(null);
  const [searchTermGasto, setSearchTermGasto] = useState('');
  const [filtroCategoriaGasto, setFiltroCategoriaGasto] = useState('TODAS');

  // Datos principales
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroMes, setFiltroMes] = useState('TODOS');
  const [filtroMedio, setFiltroMedio] = useState('TODOS');

  // Catálogos auxiliares (proveedores y productos para autocompletar)
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState([]);
  const [catalogoProductos, setCatalogoProductos] = useState([]);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal de eliminar
  const [registroAEliminar, setRegistroAEliminar] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Modal rápido de gestión de cuotas
  const [registroCuotasVer, setRegistroCuotasVer] = useState(null);

  // Formulario del Registro (Identificador automático oculto)
  const initialForm = {
    numeroRegistro: 1,
    nombreRegistro: 'Registro 1',
    proveedor: '',
    nombreTarjeta: '',
    fecha: getLocalDateString(),
    totalBoleta: '',
    costoEnvio: '',
    medioPago: 'credito',
    numCuotas: 4,
    diaPago: 5,
    mesInicio: getLocalDateString().slice(0, 7),
    cuotas: [],
    productos: [
      { id: 'p_1', nombre: '', cantidad: 1 }
    ],
    gastosOperativos: [],
    notas: ''
  };

  const [form, setForm] = useState(initialForm);
  const [showProvDropdown, setShowProvDropdown] = useState(false);

  // 1. Escuchar la colección de Firestore 'registros_envios' y 'gastos_envios' (compatibilidad total)
  useEffect(() => {
    let listRegistros = [];
    let listGastos = [];

    function combinarYOrdenar() {
      const ids = new Set();
      const combined = [];
      [...listRegistros, ...listGastos].forEach(item => {
        if (!ids.has(item.id)) {
          ids.add(item.id);
          const rawNom = item.nombreRegistro || item.nombreBoleta || item.nombrePedido || '';
          const matchNum = rawNom.match(/(?:Registro|Boleta)\s+(\d+)/i);
          const numFinal = item.numeroRegistro || item.numeroBoleta || (matchNum ? Number(matchNum[1]) : 1);
          const displayNom = `Registro ${numFinal}`;

          const norm = {
            ...item,
            numeroRegistro: numFinal,
            nombreRegistro: displayNom,
            nombreBoleta: displayNom,
            totalBoleta: item.totalBoleta !== undefined ? item.totalBoleta : (item.costoEnvio || 0),
            costoEnvio: item.costoEnvio || 0,
            medioPago: item.medioPago || 'credito',
            nombreTarjeta: item.nombreTarjeta || '',
            gastosOperativos: Array.isArray(item.gastosOperativos) ? item.gastosOperativos : [],
            totalGastosOperativos: Number(item.totalGastosOperativos) || (Array.isArray(item.gastosOperativos) ? item.gastosOperativos.reduce((a, b) => a + (Number(b.monto) || 0), 0) : 0),
            _collection: item._fromGastos ? 'gastos_envios' : 'registros_envios'
          };
          combined.push(norm);
        }
      });
      combined.sort((a, b) => {
        const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
        const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setRegistros(combined);
      setLoading(false);
    }

    const unsub1 = onSnapshot(collection(db, 'registros_envios'), (snap) => {
      listRegistros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      combinarYOrdenar();
    }, (err) => {
      console.error("Error al escuchar registros_envios:", err);
      setLoading(false);
    });

    const unsub2 = onSnapshot(collection(db, 'gastos_envios'), (snap) => {
      listGastos = snap.docs.map(d => ({ id: d.id, _fromGastos: true, ...d.data() }));
      combinarYOrdenar();
    }, () => {});

    // Escuchar colección 'gastos' (Gastos Operativos independientes: pasajes, comida, etc.)
    const unsubGastosOp = onSnapshot(collection(db, 'gastos'), (snap) => {
      const gList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      gList.sort((a, b) => new Date(b.fecha || b.createdAt || 0) - new Date(a.fecha || a.createdAt || 0));
      setGastosOperativosList(gList);
    });

    return () => {
      unsub1();
      unsub2();
      unsubGastosOp();
    };
  }, []);

  // 2. Extraer proveedores y productos desde el inventario para autocompletado
  useEffect(() => {
    const unsubProds = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const provSet = new Set(['Feyal', 'Ripley', 'Salcobrand', 'Cruz Verde']);
      const prodsList = [];

      snapshot.docs.forEach(docSnap => {
        const p = docSnap.data();
        prodsList.push({ id: docSnap.id, nombre: p.nombre || '' });
        if (p.proveedor && typeof p.proveedor === 'string' && p.proveedor.trim()) {
          provSet.add(p.proveedor.trim());
        }
        if (Array.isArray(p.lotesProveedores)) {
          p.lotesProveedores.forEach(l => {
            if (l.proveedor && typeof l.proveedor === 'string' && l.proveedor.trim()) {
              provSet.add(l.proveedor.trim());
            }
          });
        }
      });

      setProveedoresDisponibles(Array.from(provSet).sort());
      setCatalogoProductos(prodsList);
    });

    return () => unsubProds();
  }, []);

  // 3. Sugerencias de Proveedores (máximo 5 opciones coincidentes)
  const sugerenciasProveedores = useMemo(() => {
    const q = (form.proveedor || '').trim().toLowerCase();
    if (!q) {
      return proveedoresDisponibles.slice(0, 5);
    }
    return proveedoresDisponibles
      .filter(p => p.toLowerCase().includes(q))
      .slice(0, 5);
  }, [form.proveedor, proveedoresDisponibles]);

  // Tarjetas guardadas y recordadas para selección rápida en 1 clic
  const tarjetasFrecuentes = useMemo(() => {
    const set = new Set();
    registros.forEach(r => {
      if (r.nombreTarjeta && typeof r.nombreTarjeta === 'string' && r.nombreTarjeta.trim()) {
        set.add(r.nombreTarjeta.trim());
      }
    });
    // Predeterminadas para sugerencias si aún no hay registros
    ['Tarjeta BCI', 'Tarjeta Ripley', 'Banco Santander', 'BancoEstado', 'Scotiabank', 'Banco de Chile'].forEach(b => set.add(b));
    return Array.from(set).slice(0, 8);
  }, [registros]);

  // Sistema de Notificación de Pagos: cuotas por vencer en los próximos 10 días o vencidas
  const notificacionesCuotas = useMemo(() => {
    const list = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    registros.forEach(reg => {
      if (reg.medioPago === 'credito' && Array.isArray(reg.cuotas)) {
        reg.cuotas.forEach((c, idx) => {
          if (!c.pagada && c.fecha) {
            const [y, m, d] = c.fecha.split('-').map(Number);
            const fCuota = new Date(y, m - 1, d);
            fCuota.setHours(0, 0, 0, 0);
            const diasFaltantes = Math.round((fCuota - hoy) / (1000 * 60 * 60 * 24));

            if (diasFaltantes <= 10) {
              list.push({
                registroId: reg.id,
                nombreRegistro: reg.nombreRegistro || reg.nombreBoleta || 'Registro',
                proveedor: reg.proveedor || 'General',
                tarjeta: reg.nombreTarjeta || 'Tarjeta de Crédito',
                cuotaIndex: idx,
                numeroCuota: c.numero || (idx + 1),
                totalCuotas: reg.cuotas.length,
                monto: Number(c.monto) || 0,
                fecha: c.fecha,
                fechaLabel: c.fechaLabel || formatDateDMA(c.fecha),
                diasFaltantes,
                isAtrasado: diasFaltantes < 0,
                isHoy: diasFaltantes === 0
              });
            }
          }
        });
      }
    });

    return list.sort((a, b) => a.diasFaltantes - b.diasFaltantes);
  }, [registros]);

  // Recalcular cuotas cuando cambien total, numCuotas, diaPago o mesInicio
  function actualizarCuotasAutomaticas(newTotal, newNumCuotas, newDiaPago, newMesInicio, cuotasPrevias = []) {
    const cuotasGeneradas = generarCuotasCalculadas(newTotal, newNumCuotas, newDiaPago, newMesInicio);
    return cuotasGeneradas.map((c, i) => ({
      ...c,
      pagada: Boolean(cuotasPrevias[i]?.pagada)
    }));
  }

  // Manejador del cambio de parámetros de cuota en el form
  function handleParamCuotaChange(field, value) {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (updated.medioPago === 'credito') {
        updated.cuotas = actualizarCuotasAutomaticas(
          field === 'totalBoleta' ? value : updated.totalBoleta,
          field === 'numCuotas' ? value : updated.numCuotas,
          field === 'diaPago' ? value : updated.diaPago,
          field === 'mesInicio' ? value : updated.mesInicio,
          prev.cuotas
        );
      }
      return updated;
    });
  }

  // Filtrado de meses disponibles
  const mesesDisponibles = useMemo(() => {
    const set = new Set();
    registros.forEach(r => {
      if (r.fecha && r.fecha.length >= 7) {
        set.add(r.fecha.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [registros]);

  // Registros filtrados
  const registrosFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (filtroMes !== 'TODOS' && (!r.fecha || !r.fecha.startsWith(filtroMes))) {
        return false;
      }
      if (filtroMedio !== 'TODOS' && r.medioPago !== filtroMedio) {
        return false;
      }
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matchRegistro = (r.nombreRegistro || '').toLowerCase().includes(s);
        const matchProv = (r.proveedor || '').toLowerCase().includes(s);
        const matchNotas = (r.notas || '').toLowerCase().includes(s);
        const matchProds = r.productos && r.productos.some(p => (p.nombre || '').toLowerCase().includes(s));
        if (!(matchRegistro || matchProv || matchNotas || matchProds)) return false;
      }
      return true;
    });
  }, [registros, filtroMes, filtroMedio, searchTerm]);

  // Cálculos de KPIs
  const kpis = useMemo(() => {
    let totalBoletas = 0;
    let totalEnvios = 0;
    let totalProductos = 0;
    let cuotasPendientesMonto = 0;
    let cuotasPendientesCount = 0;
    let cuotasPagadasCount = 0;

    registrosFiltrados.forEach(r => {
      totalBoletas += Number(r.totalBoleta) || 0;
      totalEnvios += Number(r.costoEnvio) || 0;
      
      if (Array.isArray(r.productos)) {
        r.productos.forEach(p => {
          totalProductos += Number(p.cantidad) || 0;
        });
      }

      if (r.medioPago === 'credito' && Array.isArray(r.cuotas)) {
        r.cuotas.forEach(c => {
          if (c.pagada) {
            cuotasPagadasCount++;
          } else {
            cuotasPendientesCount++;
            cuotasPendientesMonto += Number(c.monto) || 0;
          }
        });
      }
    });

    return {
      totalBoletas,
      totalEnvios,
      totalProductos,
      cuotasPendientesMonto,
      cuotasPendientesCount,
      cuotasPagadasCount
    };
  }, [registrosFiltrados]);

  // Abrir Modal Crear (con "Registro X" automático, oculto en inputs)
  function handleAbrirNuevo() {
    setEditingId(null);
    setErrorMsg('');
    const nextNum = calcularSiguienteNumeroRegistro(registros);
    const base = {
      ...initialForm,
      numeroRegistro: nextNum,
      nombreRegistro: `Registro ${nextNum}`,
      nombreTarjeta: tarjetasFrecuentes[0] || 'Tarjeta BCI',
      gastosOperativos: []
    };
    base.cuotas = generarCuotasCalculadas(0, base.numCuotas, base.diaPago, base.mesInicio);
    setForm(base);
    setIsModalOpen(true);
  }

  // Abrir Modal Editar
  function handleEditar(reg) {
    setEditingId(reg.id);
    setErrorMsg('');
    const parsedNum = reg.numeroRegistro || reg.numeroBoleta || parseInt(String(reg.nombreRegistro || reg.nombreBoleta).replace(/\D/g, '')) || 1;
    const regNombre = `Registro ${parsedNum}`;

    setForm({
      numeroRegistro: parsedNum,
      nombreRegistro: regNombre,
      proveedor: reg.proveedor || '',
      nombreTarjeta: reg.nombreTarjeta || '',
      fecha: reg.fecha || getLocalDateString(),
      totalBoleta: reg.totalBoleta !== undefined ? reg.totalBoleta : '',
      costoEnvio: reg.costoEnvio !== undefined ? reg.costoEnvio : '',
      medioPago: reg.medioPago || 'credito',
      numCuotas: reg.numCuotas || 4,
      diaPago: reg.diaPago || 5,
      mesInicio: reg.mesInicio || (reg.fecha ? reg.fecha.slice(0, 7) : getLocalDateString().slice(0, 7)),
      cuotas: Array.isArray(reg.cuotas) ? reg.cuotas : [],
      productos: Array.isArray(reg.productos) && reg.productos.length > 0 
        ? reg.productos.map(p => ({ ...p, id: p.id || String(Math.random()) }))
        : [{ id: 'p_1', nombre: '', cantidad: 1 }],
      gastosOperativos: Array.isArray(reg.gastosOperativos)
        ? reg.gastosOperativos.map(g => ({ ...g, id: g.id || String(Math.random()) }))
        : [],
      notas: reg.notas || ''
    });
    setIsModalOpen(true);
  }

  // Guardar en Firestore
  async function handleGuardar(e) {
    e.preventDefault();
    setErrorMsg('');

    const totalNum = Number(form.totalBoleta) || 0;
    if (totalNum <= 0) {
      setErrorMsg('El total pagado debe ser un monto mayor a 0.');
      return;
    }

    const productosLimpios = form.productos
      .filter(p => p.nombre.trim() !== '')
      .map(p => ({
        nombre: p.nombre.trim(),
        cantidad: Math.max(1, parseInt(p.cantidad) || 1)
      }));

    if (productosLimpios.length === 0) {
      setErrorMsg('Debes agregar al menos un producto.');
      return;
    }

    const parsedNum = form.numeroRegistro || parseInt(String(form.nombreRegistro).replace(/\D/g, '')) || 1;
    const finalNombre = `Registro ${parsedNum}`;

    setSaving(true);
    try {
      const payload = {
        numeroRegistro: parsedNum,
        nombreRegistro: finalNombre,
        nombreBoleta: finalNombre, // compatibilidad
        proveedor: form.proveedor.trim() || 'General',
        nombreTarjeta: form.nombreTarjeta.trim() || (form.medioPago === 'credito' ? 'Tarjeta BCI' : 'Tarjeta Débito'),
        fecha: form.fecha,
        totalBoleta: totalNum,
        costoEnvio: Number(form.costoEnvio) || 0,
        medioPago: form.medioPago,
        numCuotas: form.medioPago === 'credito' ? Number(form.numCuotas) : 1,
        diaPago: form.medioPago === 'credito' ? Number(form.diaPago) : null,
        mesInicio: form.medioPago === 'credito' ? form.mesInicio : null,
        cuotas: form.medioPago === 'credito' ? form.cuotas : [],
        productos: productosLimpios,
        gastosOperativos: (form.gastosOperativos || [])
          .filter(g => Number(g.monto) > 0)
          .map(g => ({
            id: g.id || `g_${Date.now()}`,
            categoria: g.categoria || 'transporte',
            monto: Math.floor(Number(g.monto)) || 0,
            fecha: g.fecha || form.fecha || getLocalDateString(),
            descripcion: (g.descripcion || '').trim()
          })),
        totalGastosOperativos: (form.gastosOperativos || [])
          .filter(g => Number(g.monto) > 0)
          .reduce((acc, g) => acc + (Math.floor(Number(g.monto)) || 0), 0),
        notas: form.notas.trim(),
        operador: currentOperator,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'registros_envios', editingId), payload);
      } else {
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'registros_envios'), payload);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error("Error al guardar registro:", err);
      setErrorMsg("Ocurrió un error al guardar. Revisa la conexión e intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  // Eliminar (restaura automáticamente el ID al estar libre)
  async function confirmarEliminar() {
    if (!registroAEliminar) return;
    setDeleting(true);
    try {
      const colName = registroAEliminar._collection || 'registros_envios';
      await deleteDoc(doc(db, colName, registroAEliminar.id));
      setRegistroAEliminar(null);
    } catch (err) {
      console.error("Error al eliminar registro:", err);
      alert("No se pudo eliminar el registro.");
    } finally {
      setDeleting(false);
    }
  }

  // Toggle rápido de estado de cuota
  async function toggleCuotaPagada(registroId, cuotaIndex) {
    const reg = registros.find(r => r.id === registroId);
    if (!reg || !Array.isArray(reg.cuotas)) return;

    const nuevasCuotas = reg.cuotas.map((c, i) => {
      if (i === cuotaIndex) {
        return { ...c, pagada: !c.pagada };
      }
      return c;
    });

    try {
      await updateDoc(doc(db, 'registros_envios', registroId), {
        cuotas: nuevasCuotas,
        updatedAt: new Date().toISOString()
      });
      if (registroCuotasVer && registroCuotasVer.id === registroId) {
        setRegistroCuotasVer({ ...registroCuotasVer, cuotas: nuevasCuotas });
      }
    } catch (err) {
      console.error("Error al actualizar cuota:", err);
      alert("No se pudo actualizar el estado de la cuota.");
    }
  }

  // Handlers para el módulo independiente de Gastos Operativos (Pasajes, Comida, etc.)
  function handleAbrirNuevoGasto() {
    setGastoForm({
      categoria: 'transporte',
      monto: '',
      fecha: getLocalDateString(),
      descripcion: ''
    });
    setShowModalGasto(true);
  }

  async function handleGuardarGastoOperativo(e) {
    if (e) e.preventDefault();
    const montoNum = Math.floor(Number(gastoForm.monto)) || 0;
    if (montoNum <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    setSavingGasto(true);
    try {
      await addDoc(collection(db, 'gastos'), {
        categoria: gastoForm.categoria,
        monto: montoNum,
        descripcion: (gastoForm.descripcion || '').trim() || (gastoForm.categoria === 'transporte' ? 'Pasajes' : gastoForm.categoria === 'comida' ? 'Comida' : 'Gasto operativo'),
        fecha: gastoForm.fecha || getLocalDateString(),
        createdAt: new Date().toISOString(),
        operador: currentOperator
      });
      setShowModalGasto(false);
    } catch (err) {
      console.error("Error guardando gasto operativo:", err);
      alert("Hubo un error al guardar el gasto. Revisa tu conexión.");
    } finally {
      setSavingGasto(false);
    }
  }

  async function confirmarEliminarGasto() {
    if (!gastoAEliminar) return;
    try {
      await deleteDoc(doc(db, 'gastos', gastoAEliminar.id));
      setGastoAEliminar(null);
    } catch (err) {
      console.error("Error eliminando gasto:", err);
      alert("No se pudo eliminar el gasto.");
    }
  }

  // Cálculos de KPIs de Gastos Operativos
  const gastosFiltrados = useMemo(() => {
    return gastosOperativosList.filter(g => {
      if (filtroCategoriaGasto !== 'TODAS' && g.categoria !== filtroCategoriaGasto) {
        return false;
      }
      if (searchTermGasto.trim()) {
        const q = searchTermGasto.toLowerCase();
        const desc = (g.descripcion || '').toLowerCase();
        const cat = (g.categoria || '').toLowerCase();
        return desc.includes(q) || cat.includes(q);
      }
      return true;
    });
  }, [gastosOperativosList, filtroCategoriaGasto, searchTermGasto]);

  const kpisGastos = useMemo(() => {
    let totalGeneral = 0;
    let totalTransporte = 0;
    let totalComida = 0;
    let totalOtros = 0;

    gastosOperativosList.forEach(g => {
      const m = Number(g.monto) || 0;
      totalGeneral += m;
      if (g.categoria === 'transporte') totalTransporte += m;
      else if (g.categoria === 'comida') totalComida += m;
      else totalOtros += m;
    });

    return { totalGeneral, totalTransporte, totalComida, totalOtros };
  }, [gastosOperativosList]);

  // Manejo de productos en formulario
  function agregarFilaProducto() {
    setForm(prev => ({
      ...prev,
      productos: [...prev.productos, { id: `p_${Date.now()}`, nombre: '', cantidad: 1 }]
    }));
  }

  function eliminarFilaProducto(id) {
    setForm(prev => {
      if (prev.productos.length <= 1) return prev;
      return {
        ...prev,
        productos: prev.productos.filter(p => p.id !== id)
      };
    });
  }

  function actualizarProducto(id, field, value) {
    setForm(prev => ({
      ...prev,
      productos: prev.productos.map(p => {
        if (p.id === id) {
          return { ...p, [field]: value };
        }
        return p;
      })
    }));
  }

  // Exportar PDF Oficial
  function exportarPDF() {
    const docPdf = new jsPDF();
    docPdf.setFont('helvetica');

    docPdf.setFontSize(18);
    docPdf.setTextColor(30, 30, 30);
    docPdf.text('LEIS - Registros de Envíos y Compras', 14, 20);

    docPdf.setFontSize(9);
    docPdf.setTextColor(100, 100, 100);
    docPdf.text(`Generado: ${new Date().toLocaleString('es-CL')} | Operador: ${currentOperator}`, 14, 27);
    docPdf.text(`Periodo: ${filtroMes === 'TODOS' ? 'Histórico Completo' : filtroMes} | Total Registros: ${registrosFiltrados.length}`, 14, 32);

    docPdf.setFontSize(10);
    docPdf.setTextColor(40, 40, 40);
    docPdf.text(`Total en Boletas: $${kpis.totalBoletas.toLocaleString('es-CL')} (Envío integrado: $${kpis.totalEnvios.toLocaleString('es-CL')}) | Cuotas Pendientes: $${kpis.cuotasPendientesMonto.toLocaleString('es-CL')}`, 14, 40);

    const tableRows = registrosFiltrados.map(r => {
      const prodsStr = (r.productos || []).map(p => `${p.cantidad}x ${p.nombre}`).join(', ');
      
      let cuotasStr = 'Al Contado';
      if (r.medioPago === 'credito' && Array.isArray(r.cuotas)) {
        const pagadas = r.cuotas.filter(c => c.pagada).length;
        cuotasStr = `${r.numCuotas} cuotas (${pagadas}/${r.numCuotas} pagadas)`;
      }

      return [
        r.nombreRegistro || `Registro ${r.numeroRegistro || 1}`,
        formatDateDMA(r.fecha),
        r.proveedor || '—',
        `$${(Number(r.totalBoleta) || 0).toLocaleString('es-CL')}`,
        `$${(Number(r.costoEnvio) || 0).toLocaleString('es-CL')}`,
        cuotasStr,
        prodsStr
      ];
    });

    autoTable(docPdf, {
      startY: 46,
      head: [['Identificador', 'Fecha', 'Proveedor', 'Total Pagado', 'Envío Integrado', 'Pago / Cuotas', 'Productos']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [142, 109, 60], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 7, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      styles: { cellPadding: 3, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 20 },
        2: { cellWidth: 26 },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 28 },
        6: { cellWidth: 'auto' }
      }
    });

    docPdf.save(`Leis_Registros_${filtroMes}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // Exportar CSV
  function exportarCSV() {
    const headers = ['Identificador', 'Fecha', 'Proveedor', 'Total Pagado', 'Envio Integrado', 'Medio Pago', 'Total Cuotas', 'Cuotas Pagadas', 'Productos', 'Notas'];
    const rows = registrosFiltrados.map(r => {
      const prodsStr = (r.productos || []).map(p => `${p.cantidad}x ${p.nombre}`).join('; ');
      const cuotasPagadas = (r.cuotas || []).filter(c => c.pagada).length;
      return [
        `"${(r.nombreRegistro || `Registro ${r.numeroRegistro || 1}`).replace(/"/g, '""')}"`,
        r.fecha,
        `"${(r.proveedor || '').replace(/"/g, '""')}"`,
        r.totalBoleta || 0,
        r.costoEnvio || 0,
        r.medioPago || '',
        r.numCuotas || 1,
        cuotasPagadas,
        `"${prodsStr.replace(/"/g, '""')}"`,
        `"${(r.notas || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Registros_${filtroMes}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-6 md:p-10 relative flex flex-col min-h-full overflow-y-auto transition-colors duration-500">
      
      {/* ── HEADER LUXE ── */}
      <header className="sticky top-0 z-30 bg-surface/80 dark:bg-[#121212]/80 backdrop-blur-md px-6 md:px-10 py-8 flex flex-col items-center justify-center border-b border-outline-variant/20 dark:border-white/5 mb-8">
        <div className="relative text-center mx-auto w-full max-w-4xl">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 dark:text-[#e2bd6c]/60 mb-2">
            Gestión de Compras y Cuentas por Pagar
          </p>
          <h1 className="font-headline text-4xl md:text-5xl text-secondary dark:text-white italic leading-tight tracking-tighter">
            Registros de Envíos y Boletas
          </h1>
          <p className="mt-3 text-outline dark:text-gray-400 font-body max-w-lg mx-auto leading-relaxed text-[11px] uppercase tracking-widest font-bold">
            Control automático por Registro, costos de envío integrados, productos y cuotas de crédito.
          </p>
          <div className="absolute left-1/2 -bottom-4 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-primary/20 dark:via-[#e2bd6c]/20 to-transparent rounded-full" />
        </div>
      </header>

      {/* ── SELECTOR PRINCIPAL DE MÓDULOS EN REGISTRO ── */}
      <div className="flex gap-2 p-1.5 bg-surface-container dark:bg-white/5 rounded-2xl mb-8 border border-outline-variant/15 dark:border-white/5 max-w-xl mx-auto w-full shadow-sm">
        <button
          type="button"
          onClick={() => setTabPrincipal('boletas')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            tabPrincipal === 'boletas'
              ? 'bg-primary text-white dark:bg-[#e2bd6c] dark:text-black shadow-md scale-[1.01]'
              : 'text-outline hover:text-on-surface dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-lg">receipt_long</span>
          <span>Boletas & Envíos</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
            tabPrincipal === 'boletas'
              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
              : 'bg-outline-variant/20 dark:bg-white/10'
          }`}>
            {registros.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabPrincipal('gastos')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            tabPrincipal === 'gastos'
              ? 'bg-primary text-white dark:bg-[#e2bd6c] dark:text-black shadow-md scale-[1.01]'
              : 'text-outline hover:text-on-surface dark:text-gray-400 dark:hover:text-white'
          }`}
        >
          <span className="material-symbols-outlined text-lg">directions_bus</span>
          <span>Gastos Operativos</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
            tabPrincipal === 'gastos'
              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
              : 'bg-outline-variant/20 dark:bg-white/10'
          }`}>
            {gastosOperativosList.length}
          </span>
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          ── VISTA 1: BOLETAS & ENVÍOS
          ════════════════════════════════════════════════════════════ */}
      {tabPrincipal === 'boletas' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          
          {/* ── SISTEMA DE NOTIFICACIÓN DE PAGOS INTELIGENTE ── */}
          {notificacionesCuotas.length > 0 && (
            <section className="animate-in fade-in duration-200">
              <div className="p-5 md:p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl shadow-lg shadow-amber-500/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-bold shadow-md">
                      <span className="material-symbols-outlined text-xl">notifications_active</span>
                    </div>
                    <div>
                      <h3 className="font-headline font-bold text-base md:text-lg text-secondary dark:text-white leading-tight">
                        Notificaciones de Pagos ({notificacionesCuotas.length})
                      </h3>
                      <p className="text-[10px] text-amber-700 dark:text-[#e2bd6c] font-bold uppercase tracking-wider mt-0.5">
                        Cuotas de crédito vencidas o con vencimiento en los próximos 10 días
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {notificacionesCuotas.map((n, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        n.isAtrasado
                          ? 'bg-red-500/10 border-red-500/30'
                          : n.isHoy
                            ? 'bg-amber-500/20 border-amber-500/40'
                            : 'bg-surface dark:bg-white/5 border-outline-variant/20 dark:border-white/10'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black uppercase text-primary dark:text-[#e2bd6c]">
                            {n.nombreRegistro}
                          </span>
                          <span className="text-[9px] text-outline font-bold truncate">
                            • {n.tarjeta}
                          </span>
                        </div>

                        <p className="font-headline font-black text-sm text-secondary dark:text-white mt-0.5">
                          ${n.monto.toLocaleString('es-CL')}
                          <span className="text-[9px] text-outline font-bold ml-1 font-sans">
                            (Cuota #{n.numeroCuota}/{n.totalCuotas})
                          </span>
                        </p>

                        <p className="text-[9px] font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                          {n.isAtrasado ? (
                            <span className="text-red-600 dark:text-red-400 font-black animate-pulse flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[11px]">warning</span>
                              Vencida hace {Math.abs(n.diasFaltantes)} días ({n.fechaLabel})
                            </span>
                          ) : n.isHoy ? (
                            <span className="text-amber-600 dark:text-amber-400 font-black flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[11px]">alarm</span>
                              ¡Vence Hoy! ({n.fechaLabel})
                            </span>
                          ) : (
                            <span className="text-outline dark:text-gray-400">
                              Vence en {n.diasFaltantes} días ({n.fechaLabel})
                            </span>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleCuotaPagada(n.registroId, n.cuotaIndex)}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider shadow-sm transition-all shrink-0 flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Marcar esta cuota como pagada"
                      >
                        <span className="material-symbols-outlined text-[12px]">check</span>
                        <span>Pagada</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── TARJETAS DE KPIS FINANCIEROS (BOLETAS) ── */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Total Boletas */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-primary/40 dark:hover:border-[#e2bd6c]/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline dark:text-gray-400">Total en Boletas</span>
                <div className="w-9 h-9 rounded-2xl bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">receipt_long</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-secondary dark:text-white">
                  ${kpis.totalBoletas.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  {registrosFiltrados.length} registro{registrosFiltrados.length !== 1 ? 's' : ''} en el periodo
                </p>
              </div>
            </div>

            {/* Total Envíos (Integrado) */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-blue-500/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline dark:text-gray-400">Envíos (Integrados)</span>
                <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">local_shipping</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-blue-600 dark:text-blue-400">
                  ${kpis.totalEnvios.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  Incluido dentro del Total pagado
                </p>
              </div>
            </div>

            {/* Cuotas Pendientes de Crédito */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline dark:text-gray-400">Cuotas por Pagar</span>
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">credit_card</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-amber-600 dark:text-amber-400">
                  ${kpis.cuotasPendientesMonto.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  {kpis.cuotasPendientesCount} cuota{kpis.cuotasPendientesCount !== 1 ? 's' : ''} pendiente{kpis.cuotasPendientesCount !== 1 ? 's' : ''} ({kpis.cuotasPagadasCount} pagadas)
                </p>
              </div>
            </div>

            {/* Total Artículos Recibidos */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline dark:text-gray-400">Total Productos</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">inventory_2</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-emerald-600 dark:text-emerald-400">
                  {kpis.totalProductos.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  Unidades físicas recibidas
                </p>
              </div>
            </div>
          </section>

          {/* ── BARRA DE CONTROLES: FILTROS + BOTÓN REGISTRAR COMPRA ── */}
          <section className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl p-4 md:p-6 border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/60 text-lg">search</span>
                <input 
                  type="text" 
                  placeholder="Buscar por Registro, proveedor o producto..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-surface dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-[#e2bd6c]/40"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              <select 
                value={filtroMes}
                onChange={e => setFiltroMes(e.target.value)}
                className="bg-surface dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-2.5 text-xs font-bold text-on-surface dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Meses</option>
                {mesesDisponibles.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select 
                value={filtroMedio}
                onChange={e => setFiltroMedio(e.target.value)}
                className="bg-surface dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-2.5 text-xs font-bold text-on-surface dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="TODOS">Todos los Pagos</option>
                <option value="credito">Crédito</option>
                <option value="debito">Débito / Transf.</option>
                <option value="efectivo">Efectivo</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={exportarPDF}
                title="Exportar Reporte en PDF"
                className="px-3.5 py-2.5 rounded-2xl border border-outline-variant/20 dark:border-white/10 hover:bg-surface-variant dark:hover:bg-white/5 text-on-surface dark:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-red-500">picture_as_pdf</span>
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button 
                type="button"
                onClick={exportarCSV}
                title="Exportar Planilla Excel / CSV"
                className="px-3.5 py-2.5 rounded-2xl border border-outline-variant/20 dark:border-white/10 hover:bg-surface-variant dark:hover:bg-white/5 text-on-surface dark:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-base text-emerald-500">table_view</span>
                <span className="hidden sm:inline">Excel</span>
              </button>

              <button 
                type="button"
                onClick={handleAbrirNuevo}
                className="px-5 py-2.5 rounded-2xl bg-primary text-white dark:bg-[#e2bd6c] dark:text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>+ Registrar Compra</span>
              </button>
            </div>
          </section>

          {/* ── LISTADO PRINCIPAL DE REGISTROS DE BOLETAS ── */}
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <span className="w-8 h-8 border-4 border-primary/20 dark:border-[#e2bd6c]/20 border-t-primary dark:border-t-[#e2bd6c] rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-widest text-outline">Cargando registros...</p>
            </div>
          ) : registrosFiltrados.length === 0 ? (
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl p-12 text-center border border-outline-variant/15 dark:border-white/5 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-3xl">receipt_long</span>
              </div>
              <h3 className="font-headline font-bold text-xl text-secondary dark:text-white">No hay registros creados</h3>
              <p className="text-xs text-outline dark:text-gray-400 max-w-md mx-auto">
                {searchTerm || filtroMes !== 'TODOS' || filtroMedio !== 'TODOS'
                  ? 'No se encontraron resultados con los filtros aplicados. Prueba limpiar la búsqueda.'
                  : 'Comienza agregando tu primer registro de compra con sus productos y flete integrado.'}
              </p>
              <button 
                onClick={handleAbrirNuevo}
                className="px-6 py-3 rounded-2xl bg-primary text-white dark:bg-[#e2bd6c] dark:text-black font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Crear Primer Registro</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
              {registrosFiltrados.map(reg => {
                const numCuotas = reg.numCuotas || 1;
                const cuotasList = Array.isArray(reg.cuotas) ? reg.cuotas : [];
                const cuotasPagadas = cuotasList.filter(c => c.pagada).length;
                const todasPagadas = reg.medioPago === 'credito' ? (cuotasPagadas === numCuotas && numCuotas > 0) : true;
                const envioNum = Number(reg.costoEnvio) || 0;
                const totalNum = Number(reg.totalBoleta) || 0;
                const tituloRegistro = reg.nombreRegistro || `Registro ${reg.numeroRegistro || 1}`;

                return (
                  <div 
                    key={reg.id}
                    className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl border border-outline-variant/15 dark:border-white/5 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Fila Superior: Nombre Registro Correlativo, Proveedor y Fecha */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <span className="text-xs font-black uppercase tracking-wider text-primary dark:text-[#e2bd6c] block">
                            {tituloRegistro}
                          </span>
                          <h4 className="font-headline font-bold text-base text-secondary dark:text-white leading-tight">
                            {reg.proveedor || 'Proveedor General'}
                          </h4>
                        </div>
                        <span className="text-[10px] font-bold text-outline dark:text-gray-400 bg-surface dark:bg-white/5 px-2.5 py-1 rounded-xl shrink-0">
                          {formatDateDMA(reg.fecha)}
                        </span>
                      </div>

                      {/* Fila de Totales: Total con Envío Integrado */}
                      <div className="bg-surface dark:bg-[#141414] p-3.5 rounded-2xl border border-outline-variant/10 dark:border-white/5 mb-4">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-outline block">Total Pagado</span>
                            <span className="font-headline font-black text-xl text-secondary dark:text-white">
                              ${totalNum.toLocaleString('es-CL')}
                            </span>
                          </div>
                          {envioNum > 0 && (
                            <div className="text-right">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 block">Envío Integrado</span>
                              <span className="font-headline font-bold text-sm text-blue-600 dark:text-blue-400">
                                ${envioNum.toLocaleString('es-CL')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Medio de Pago & Cuotas */}
                      <div className="flex flex-wrap items-center gap-2 mb-4 text-[10px]">
                        <span className="font-black uppercase tracking-wider px-2.5 py-1 rounded-xl bg-surface dark:bg-white/5 text-secondary dark:text-white flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">
                            {reg.medioPago === 'credito' ? 'credit_card' : 'account_balance_wallet'}
                          </span>
                          {reg.medioPago === 'credito' ? 'Tarjeta Crédito' : 'Tarjeta Débito'}
                        </span>

                        {reg.nombreTarjeta && (
                          <span className="font-bold px-2 py-0.5 rounded-lg bg-surface dark:bg-white/5 text-outline">
                            {reg.nombreTarjeta}
                          </span>
                        )}

                        {reg.medioPago === 'credito' && (
                          <button
                            type="button"
                            onClick={() => setRegistroCuotasVer(reg)}
                            className={`font-black uppercase tracking-wider px-2.5 py-1 rounded-xl flex items-center gap-1 cursor-pointer transition-all ${
                              todasPagadas
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                            }`}
                            title="Gestionar cuotas individuales"
                          >
                            <span className="material-symbols-outlined text-xs">calendar_month</span>
                            <span>{cuotasPagadas}/{numCuotas} Pagadas</span>
                          </button>
                        )}
                      </div>

                      {/* Resumen de Productos Físicos Asignados */}
                      {Array.isArray(reg.productos) && reg.productos.length > 0 && (
                        <div className="space-y-1.5 mb-4">
                          <span className="text-[9px] font-black uppercase tracking-wider text-outline block">
                            Productos en este registro ({reg.productos.reduce((acc, p) => acc + (Number(p.cantidad) || 0), 0)} u.)
                          </span>
                          <div className="bg-surface/50 dark:bg-white/[0.02] rounded-xl p-2.5 border border-outline-variant/10 dark:border-white/5 max-h-32 overflow-y-auto space-y-1">
                            {reg.productos.map((prod, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between text-xs">
                                <span className="font-medium text-secondary dark:text-gray-300 truncate max-w-[75%]">
                                  {prod.nombre || 'Producto'}
                                </span>
                                <span className="font-black text-primary dark:text-[#e2bd6c]">
                                  x{prod.cantidad}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notas opcionales */}
                      {reg.notas && (
                        <p className="text-[11px] text-outline dark:text-gray-400 italic line-clamp-2 bg-surface dark:bg-[#141414] p-2 rounded-xl mb-4">
                          "{reg.notas}"
                        </p>
                      )}
                    </div>

                    {/* Fila Inferior: Operador y Acciones */}
                    <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10 dark:border-white/5 text-[10px]">
                      <span className="text-outline/70 font-medium italic">
                        {reg.operador ? `Por ${reg.operador}` : 'Sistema'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {reg.medioPago === 'credito' && (
                          <button 
                            type="button"
                            onClick={() => setRegistroCuotasVer(reg)}
                            title="Ver / Gestionar Cuotas"
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs">schedule</span>
                            <span>Cuotas</span>
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => handleEditar(reg)}
                          title="Editar Registro"
                          className="w-8 h-8 rounded-xl bg-surface hover:bg-surface-variant dark:bg-white/5 dark:hover:bg-white/10 text-on-surface dark:text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => setRegistroAEliminar(reg)}
                          title="Eliminar Registro"
                          className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          ── VISTA 2: MÓDULO INDEPENDIENTE DE GASTOS OPERATIVOS
          ════════════════════════════════════════════════════════════ */}
      {tabPrincipal === 'gastos' && (
        <div className="space-y-8 animate-in fade-in duration-200 mb-12">
          
          {/* TARJETAS KPIS DE GASTOS OPERATIVOS */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Total Gastos */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-amber-500/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-outline dark:text-gray-400">Total Gastos Op.</span>
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">payments</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-secondary dark:text-white">
                  ${kpisGastos.totalGeneral.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  {gastosOperativosList.length} registro{gastosOperativosList.length !== 1 ? 's' : ''} en total
                </p>
              </div>
            </div>

            {/* Total Pasajes */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-blue-500/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Pasajes / Transporte</span>
                <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">directions_bus</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-blue-600 dark:text-blue-400">
                  ${kpisGastos.totalTransporte.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  Metro, micros, viajes de compras
                </p>
              </div>
            </div>

            {/* Total Comida */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-amber-600/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Comida / Alimentación</span>
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">restaurant</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-amber-600 dark:text-amber-400">
                  ${kpisGastos.totalComida.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  Colaciones en gestión de compras
                </p>
              </div>
            </div>

            {/* Total Otros */}
            <div className="bg-surface-container-low dark:bg-[#1e1e1e] p-5 rounded-3xl border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col justify-between group hover:border-emerald-500/40 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Otros / Gastos Varios</span>
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">receipt</span>
                </div>
              </div>
              <div>
                <p className="font-headline font-black text-2xl md:text-3xl text-emerald-600 dark:text-emerald-400">
                  ${kpisGastos.totalOtros.toLocaleString('es-CL')}
                </p>
                <p className="text-[10px] text-outline/80 dark:text-gray-400 font-medium mt-1">
                  Gastos menores no clasificados
                </p>
              </div>
            </div>
          </section>

          {/* BARRA DE CONTROLES: BUSCADOR DE GASTOS, FILTRO CATEGORÍA Y BOTÓN NUEVO GASTO */}
          <section className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl p-4 md:p-6 border border-outline-variant/15 dark:border-white/5 shadow-sm flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline/60 text-lg">search</span>
                <input 
                  type="text" 
                  placeholder="Buscar gasto por detalle o motivo..." 
                  value={searchTermGasto}
                  onChange={e => setSearchTermGasto(e.target.value)}
                  className="w-full bg-surface dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-[#e2bd6c]/40"
                />
                {searchTermGasto && (
                  <button 
                    onClick={() => setSearchTermGasto('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              <select 
                value={filtroCategoriaGasto}
                onChange={e => setFiltroCategoriaGasto(e.target.value)}
                className="bg-surface dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-2.5 text-xs font-bold text-on-surface dark:text-white focus:outline-none cursor-pointer"
              >
                <option value="TODAS">Todas las Categorías</option>
                <option value="transporte">Pasajes / Transporte</option>
                <option value="comida">Comida / Alimentación</option>
                <option value="otros">Otros / Varios</option>
              </select>
            </div>

            <button 
              type="button"
              onClick={handleAbrirNuevoGasto}
              className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white dark:text-black font-black text-xs uppercase tracking-wider shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span>+ Registrar Gasto</span>
            </button>
          </section>

          {/* LISTADO DE GASTOS OPERATIVOS */}
          {gastosOperativosList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-outline-variant/20 dark:border-white/10 bg-surface-container-low/40">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">directions_bus</span>
              </div>
              <h3 className="font-headline font-bold text-xl text-secondary dark:text-white mb-2">
                No hay gastos operativos registrados
              </h3>
              <p className="text-xs text-outline dark:text-gray-400 max-w-md mx-auto mb-5">
                Registra pasajes de metro, micro o alimentación incurridos durante la gestión de compras o despacho.
              </p>
              <button 
                type="button"
                onClick={handleAbrirNuevoGasto}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white dark:text-black font-black text-xs uppercase tracking-wider shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Registrar Primer Gasto</span>
              </button>
            </div>
          ) : gastosFiltrados.length === 0 ? (
            <div className="p-12 text-center rounded-3xl border border-dashed border-outline-variant/20 dark:border-white/10 bg-surface-container-low/40">
              <span className="material-symbols-outlined text-3xl text-outline mb-2">search_off</span>
              <h3 className="font-headline font-bold text-lg text-secondary dark:text-white mb-1">
                No se encontraron gastos
              </h3>
              <p className="text-xs text-outline dark:text-gray-400">
                Prueba cambiando los términos de búsqueda o el filtro de categoría.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {gastosFiltrados.map(g => {
                const isTransporte = g.categoria === 'transporte';
                const isComida = g.categoria === 'comida';
                const montoNum = Number(g.monto) || 0;

                return (
                  <div 
                    key={g.id}
                    className="bg-white dark:bg-[#1e1e1e] rounded-3xl border border-outline-variant/35 dark:border-white/10 p-5 shadow-md shadow-black/[0.04] dark:shadow-none hover:shadow-xl hover:scale-[1.01] transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-outline-variant/10 dark:border-white/5 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                            isTransporte 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                              : isComida 
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' 
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            <span className="material-symbols-outlined text-xl">
                              {isTransporte ? 'directions_bus' : isComida ? 'restaurant' : 'payments'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-outline block">
                              {isTransporte ? 'Pasajes / Transporte' : isComida ? 'Comida / Alimentación' : 'Gasto Varios'}
                            </span>
                            <h4 className="font-headline font-bold text-base text-secondary dark:text-white leading-tight">
                              {g.descripcion || (isTransporte ? 'Pasajes' : isComida ? 'Comida' : 'Gasto operativo')}
                            </h4>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setGastoAEliminar(g)}
                          className="w-8 h-8 rounded-xl text-outline/50 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all cursor-pointer"
                          title="Eliminar gasto"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>

                      <div className="flex items-baseline justify-between pt-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-outline">
                          Monto Pagado
                        </span>
                        <span className="font-headline font-black text-2xl text-amber-600 dark:text-amber-400">
                          ${montoNum.toLocaleString('es-CL')}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-outline-variant/10 dark:border-white/5 flex items-center justify-between text-[10px]">
                      <span className="font-bold text-outline dark:text-gray-400 flex items-center gap-1 bg-surface dark:bg-white/5 px-2.5 py-1 rounded-xl">
                        <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                        {formatDateDMA(g.fecha)}
                      </span>
                      {g.operador && (
                        <span className="text-outline/70 font-medium italic">
                          Por {g.operador}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ── MODAL DE CREAR / EDITAR REGISTRO ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setIsModalOpen(false)} />
          
          <div className="bg-surface dark:bg-[#161616] border border-outline-variant/20 dark:border-white/10 rounded-[2.5rem] shadow-2xl relative z-10 animate-in zoom-in-95 duration-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* CABECERA INTACTA Y FIJA (CON BADGE DE REGISTRO ASIGNADO) */}
            <div className="px-6 md:px-8 pt-6 pb-4 border-b border-outline-variant/15 dark:border-white/10 flex items-center justify-between shrink-0 bg-surface dark:bg-[#161616]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">receipt_long</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-headline font-bold text-xl text-secondary dark:text-white">
                      {editingId ? 'Editar Registro' : 'Nuevo Registro'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      {editingId ? `Editando: ${form.nombreRegistro}` : `Asignando: ${form.nombreRegistro}`}
                    </span>
                  </div>
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider mt-0.5">
                    Registra compra, flete y calendario de cuotas
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-variant dark:bg-white/10 flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* CONTENIDO DESLIZABLE */}
            <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1">
              {errorMsg && (
                <div className="mb-5 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleGuardar} className="space-y-6">
                
                {/* FILA 1: PROVEEDOR (BÚSQUEDA PREDICTIVA) + FECHA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Proveedor con autocompletado predictivo (máx 5) */}
                  <div className="relative">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c] mb-1.5 ml-1">
                      Proveedor * (Búsqueda en Inventario)
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Ej: Feyal, Ripley, Salcobrand..."
                        value={form.proveedor}
                        onChange={e => {
                          setForm({ ...form, proveedor: e.target.value });
                          setShowProvDropdown(true);
                        }}
                        onFocus={() => setShowProvDropdown(true)}
                        className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-[#e2bd6c]/40"
                      />
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline/50 pointer-events-none text-base">
                        store
                      </span>
                    </div>

                    {/* Menú de sugerencias predictivas (máx 5) */}
                    {showProvDropdown && sugerenciasProveedores.length > 0 && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowProvDropdown(false)} />
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-surface-container-highest dark:bg-[#252525] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-150">
                          <div className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-outline/70 border-b border-outline-variant/10">
                            Sugerencias de Inventario (Máx 5)
                          </div>
                          {sugerenciasProveedores.map((prov, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setForm({ ...form, proveedor: prov });
                                setShowProvDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-on-surface dark:text-white hover:bg-primary/10 dark:hover:bg-[#e2bd6c]/15 hover:text-primary dark:hover:text-[#e2bd6c] transition-all flex items-center justify-between"
                            >
                              <span>{prov}</span>
                              <span className="material-symbols-outlined text-xs opacity-50">arrow_forward</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Fecha del Registro */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c] mb-1.5 ml-1">
                      Fecha del Registro
                    </label>
                    <input 
                      type="date"
                      value={form.fecha}
                      onChange={e => setForm({ ...form, fecha: e.target.value })}
                      className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* FILA 2: TOTAL PAGADO + COSTO ENVÍO (INTEGRADO EN EL TOTAL) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c] mb-1.5 ml-1">
                      Total Pagado ($) *
                    </label>
                    <input 
                      type="number"
                      min="0"
                      placeholder="Ej: 220000"
                      value={form.totalBoleta}
                      onChange={e => handleParamCuotaChange('totalBoleta', e.target.value)}
                      className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-base font-black text-secondary dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="text-[9px] text-outline font-medium block mt-1 ml-1">
                      Monto final pagado en la boleta
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-blue-500 mb-1.5 ml-1">
                      Costo de Envío ($) (Ya integrado)
                    </label>
                    <input 
                      type="number"
                      min="0"
                      placeholder="Ej: 20000"
                      value={form.costoEnvio}
                      onChange={e => setForm({ ...form, costoEnvio: e.target.value })}
                      className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-blue-600 dark:text-blue-400 focus:outline-none"
                    />
                    <span className="text-[9px] text-blue-500/80 font-medium block mt-1 ml-1">
                      {Number(form.costoEnvio) > 0 && Number(form.totalBoleta) > 0 
                        ? `Integrado en los $${Number(form.totalBoleta).toLocaleString('es-CL')} (Productos: $${Math.max(0, Number(form.totalBoleta) - Number(form.costoEnvio)).toLocaleString('es-CL')})` 
                        : 'Viene integrado dentro del Total pagado'}
                    </span>
                  </div>
                </div>

                {/* PRODUCTOS INCLUIDOS EN LA BOLETA (SIN PRECIOS, SOLO CANTIDADES) */}
                <div className="bg-surface-container/30 dark:bg-white/[0.02] p-4 rounded-3xl border border-outline-variant/15 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-base">inventory_2</span>
                      <label className="text-[10px] font-black uppercase tracking-wider text-secondary dark:text-white">
                        Productos de la Boleta (Sin precios, solo cantidades)
                      </label>
                    </div>
                    <button 
                      type="button"
                      onClick={agregarFilaProducto}
                      className="text-[10px] font-black uppercase px-3 py-1 rounded-xl bg-primary/10 text-primary dark:bg-[#e2bd6c]/10 dark:text-[#e2bd6c] hover:bg-primary/20 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      <span>+ Agregar Producto</span>
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {form.productos.map((prod, idx) => (
                      <div key={prod.id || idx} className="flex items-center gap-2 bg-surface dark:bg-[#1f1f1f] p-2 rounded-2xl border border-outline-variant/10">
                        
                        {/* Nombre Producto con datalist de catálogo */}
                        <div className="flex-1">
                          <input 
                            type="text"
                            placeholder="Nombre del producto..."
                            list={`cat_prods_${idx}`}
                            value={prod.nombre}
                            onChange={e => actualizarProducto(prod.id, 'nombre', e.target.value)}
                            className="w-full bg-transparent px-3 py-2 text-xs font-bold text-on-surface dark:text-white focus:outline-none"
                          />
                          <datalist id={`cat_prods_${idx}`}>
                            {catalogoProductos.slice(0, 15).map(cp => (
                              <option key={cp.id} value={cp.nombre} />
                            ))}
                          </datalist>
                        </div>

                        {/* Cantidad */}
                        <div className="w-24 flex items-center gap-1 bg-surface-container dark:bg-white/5 px-2.5 py-1.5 rounded-xl border border-outline-variant/10">
                          <input 
                            type="number"
                            min="1"
                            placeholder="Cant."
                            value={prod.cantidad}
                            onChange={e => actualizarProducto(prod.id, 'cantidad', e.target.value)}
                            className="w-full bg-transparent text-center text-xs font-black text-on-surface dark:text-white focus:outline-none"
                          />
                          <span className="text-[9px] text-outline font-bold">u.</span>
                        </div>

                        {/* Botón Eliminar fila */}
                        {form.productos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => eliminarFilaProducto(prod.id)}
                            className="w-8 h-8 rounded-xl text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* MEDIO DE PAGO Y GESTIÓN DE CUOTAS */}
                <div className="bg-surface-container/30 dark:bg-white/[0.02] p-4 rounded-3xl border border-outline-variant/15 dark:border-white/5 space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-white mb-2 ml-1">
                      Medio de Pago
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {MEDIOS_PAGO.map(mp => (
                        <button
                          key={mp.id}
                          type="button"
                          onClick={() => {
                            setForm(prev => {
                              const updated = { ...prev, medioPago: mp.id };
                              if (mp.id === 'credito') {
                                updated.cuotas = actualizarCuotasAutomaticas(updated.totalBoleta, updated.numCuotas, updated.diaPago, updated.mesInicio, prev.cuotas);
                              }
                              return updated;
                            });
                          }}
                          className={`p-3.5 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            form.medioPago === mp.id
                              ? 'bg-primary text-white dark:bg-[#e2bd6c] dark:text-black border-transparent shadow-md scale-[1.02]'
                              : 'bg-surface dark:bg-[#1a1a1a] text-outline dark:text-gray-300 border-outline-variant/20 hover:border-primary/40'
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl">{mp.icon}</span>
                          <span>{mp.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nombre de la Tarjeta con Memoria de Tarjetas */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center mb-1.5 ml-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c]">
                        Nombre de la Tarjeta * (se guardará para próximas compras)
                      </label>
                      <span className="text-[9px] text-outline font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">bookmark</span>
                        Memoria activa
                      </span>
                    </div>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder="Ej: Tarjeta BCI, Tarjeta Ripley, Santander..."
                        value={form.nombreTarjeta}
                        onChange={e => setForm({ ...form, nombreTarjeta: e.target.value })}
                        className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-[#e2bd6c]/40"
                      />
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline/50 pointer-events-none text-base">
                        credit_card
                      </span>
                    </div>

                    {/* Chips recomendados / tarjetas guardadas */}
                    {tarjetasFrecuentes.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-outline/70 mr-1 flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[11px]">history</span>
                          Recomendadas:
                        </span>
                        {tarjetasFrecuentes.map((tName, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setForm({ ...form, nombreTarjeta: tName })}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border cursor-pointer ${
                              form.nombreTarjeta.toLowerCase() === tName.toLowerCase()
                                ? 'bg-primary text-white dark:bg-[#e2bd6c] dark:text-black border-transparent shadow-sm'
                                : 'bg-surface-container-highest/60 dark:bg-white/5 text-on-surface-variant dark:text-gray-300 border-outline-variant/15 hover:border-primary/40'
                            }`}
                          >
                            {tName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DETALLE DE CUOTAS A CRÉDITO */}
                  {form.medioPago === 'credito' && (
                    <div className="space-y-4 pt-2 border-t border-outline-variant/10 dark:border-white/5 animate-in fade-in duration-200">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider text-amber-500 mb-1 ml-1">
                            N° de Cuotas
                          </label>
                          <input 
                            type="number"
                            min="1"
                            max="48"
                            value={form.numCuotas}
                            onChange={e => handleParamCuotaChange('numCuotas', e.target.value)}
                            className="w-full bg-surface dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-2 text-xs font-bold text-on-surface dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider text-amber-500 mb-1 ml-1">
                            Día del mes de pago
                          </label>
                          <input 
                            type="number"
                            min="1"
                            max="31"
                            placeholder="Ej: 5"
                            value={form.diaPago}
                            onChange={e => handleParamCuotaChange('diaPago', e.target.value)}
                            className="w-full bg-surface dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-2 text-xs font-bold text-on-surface dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider text-amber-500 mb-1 ml-1">
                            Mes Primer Pago
                          </label>
                          <input 
                            type="month"
                            value={form.mesInicio}
                            onChange={e => handleParamCuotaChange('mesInicio', e.target.value)}
                            className="w-full bg-surface dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-2 text-xs font-bold text-on-surface dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Previsualización del Calendario de Cuotas */}
                      <div className="bg-surface dark:bg-[#141414] p-3 rounded-2xl border border-outline-variant/10 space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-outline px-1">
                          <span>Calendario de Vencimiento de Cuotas</span>
                          <span>Monto por Cuota: ${Math.round(form.totalBoleta / (form.numCuotas || 1)).toLocaleString('es-CL')}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {form.cuotas.map((cuota, cIdx) => (
                            <div 
                              key={cIdx}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                cuota.pagada
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-surface-container dark:bg-white/5 border-outline-variant/10 text-on-surface dark:text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-black text-[11px] w-5 text-outline">#{cuota.numero}</span>
                                <div>
                                  <p className="font-bold">{cuota.fechaLabel}</p>
                                  <p className="text-[10px] opacity-75">${cuota.monto.toLocaleString('es-CL')}</p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setForm(prev => ({
                                    ...prev,
                                    cuotas: prev.cuotas.map((c, i) => i === cIdx ? { ...c, pagada: !c.pagada } : c)
                                  }));
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase cursor-pointer ${
                                  cuota.pagada 
                                    ? 'bg-emerald-500 text-white shadow-sm' 
                                    : 'bg-surface-variant dark:bg-white/10 text-outline hover:text-on-surface'
                                }`}
                              >
                                {cuota.pagada ? 'Pagada' : 'Pendiente'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* NOTAS */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-outline mb-1.5 ml-1">
                    Notas / Observaciones
                  </label>
                  <textarea 
                    rows="2"
                    placeholder="Detalles sobre entrega o número de folio físico..."
                    value={form.notas}
                    onChange={e => setForm({ ...form, notas: e.target.value })}
                    className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-2.5 text-xs font-bold text-on-surface dark:text-white focus:outline-none"
                  />
                </div>

                {/* BOTONES MODAL AL FINAL DEL FORM */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/15 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={saving}
                    className="px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider text-outline hover:text-on-surface transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-3 rounded-2xl bg-primary text-white dark:bg-[#e2bd6c] dark:text-black font-black text-xs uppercase tracking-wider shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        <span>{editingId ? 'Actualizar Registro' : 'Guardar Registro'}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL RÁPIDO PARA GESTIONAR CUOTAS ── */}
      {registroCuotasVer && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setRegistroCuotasVer(null)} />
          <div className="bg-surface dark:bg-[#161616] border border-outline-variant/20 dark:border-white/10 rounded-[2rem] p-6 max-w-md w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-500">Gestión de Cuotas</span>
                <h3 className="font-headline font-bold text-lg text-secondary dark:text-white">
                  {registroCuotasVer.nombreRegistro || `Registro ${registroCuotasVer.numeroRegistro || 1}`}
                </h3>
                <p className="text-[10px] text-outline">
                  Total: ${(Number(registroCuotasVer.totalBoleta) || 0).toLocaleString('es-CL')}
                </p>
              </div>
              <button 
                onClick={() => setRegistroCuotasVer(null)}
                className="w-8 h-8 rounded-full bg-surface-variant dark:bg-white/10 flex items-center justify-center text-outline cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1 mb-4">
              {(registroCuotasVer.cuotas || []).map((cuota, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                    cuota.pagada 
                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                      : 'bg-surface-container dark:bg-white/5 border-outline-variant/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-xs text-outline w-5">#{cuota.numero}</span>
                    <div>
                      <p className="font-bold text-secondary dark:text-white">{cuota.fechaLabel}</p>
                      <p className="text-[10px] text-outline">${(Number(cuota.monto) || 0).toLocaleString('es-CL')}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCuotaPagada(registroCuotasVer.id, idx)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
                      cuota.pagada
                        ? 'bg-emerald-500 text-white shadow-sm hover:bg-emerald-600'
                        : 'bg-amber-500 text-black shadow-sm hover:brightness-110'
                    }`}
                  >
                    {cuota.pagada ? 'Pagada' : 'Marcar Pagada'}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setRegistroCuotasVer(null)}
              className="w-full py-2.5 rounded-xl bg-surface-variant dark:bg-white/10 text-xs font-bold text-on-surface dark:text-white uppercase tracking-wider"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMACIÓN PARA ELIMINAR ── */}
      {registroAEliminar && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setRegistroAEliminar(null)} />
          <div className="bg-surface dark:bg-[#161616] border border-outline-variant/20 dark:border-white/10 rounded-[2rem] p-6 max-w-sm w-full shadow-2xl relative z-10 text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">delete_forever</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-secondary dark:text-white mb-2">
              ¿Eliminar Registro?
            </h3>
            <p className="text-xs text-outline mb-6">
              Se eliminará el registro de <strong>"{registroAEliminar.nombreRegistro || `Registro ${registroAEliminar.numeroRegistro || 1}`}"</strong> por ${(Number(registroAEliminar.totalBoleta) || 0).toLocaleString('es-CL')}. Al eliminarlo, su número ({registroAEliminar.nombreRegistro || `Registro ${registroAEliminar.numeroRegistro || 1}`}) quedará libre para reutilizarse automáticamente en el siguiente registro.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRegistroAEliminar(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-surface-variant dark:bg-white/10 text-xs font-bold uppercase tracking-wider text-outline cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminar}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-black uppercase tracking-wider shadow-lg cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Borrando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      {/* ── MODAL INDEPENDIENTE: REGISTRAR GASTO OPERATIVO (PASAJES, COMIDA, ETC.) ── */}
      {showModalGasto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface dark:bg-[#141414] border border-outline-variant/20 dark:border-white/10 rounded-[2.5rem] max-w-lg w-full p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            {/* Cabecera del modal */}
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-outline-variant/10 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-[#e2bd6c] flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">directions_bus</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-xl text-secondary dark:text-white leading-tight">
                    Registrar Gasto Operativo
                  </h3>
                  <p className="text-[10px] uppercase tracking-wider text-outline dark:text-gray-400 font-bold mt-0.5">
                    Pasajes, Comida, etc. (En fecha específica)
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setShowModalGasto(false)}
                className="w-8 h-8 rounded-full bg-surface-variant dark:bg-white/10 flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleGuardarGastoOperativo} className="space-y-4">
              
              {/* Selector de Categoría con 3 botones claros */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c] mb-2 ml-1">
                  Categoría del Gasto *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIAS_GASTOS_OP.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setGastoForm(prev => ({ ...prev, categoria: cat.id }))}
                      className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        gastoForm.categoria === cat.id
                          ? 'bg-amber-500 text-white dark:text-black border-transparent shadow-md scale-[1.02]'
                          : 'bg-surface-container dark:bg-white/5 text-outline dark:text-gray-300 border-outline-variant/15 hover:border-amber-500/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                      <span className="text-[10px] uppercase tracking-wider">{cat.label.split('/')[0].trim()}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fila: Monto + Fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c] mb-1.5 ml-1">
                    Monto ($) *
                  </label>
                  <input 
                    type="number"
                    min="1"
                    placeholder="Ej: 3500"
                    value={gastoForm.monto}
                    onChange={e => setGastoForm({ ...gastoForm, monto: e.target.value })}
                    className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-sm font-black text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c] mb-1.5 ml-1">
                    Fecha del Gasto *
                  </label>
                  <input 
                    type="date"
                    value={gastoForm.fecha}
                    onChange={e => setGastoForm({ ...gastoForm, fecha: e.target.value })}
                    className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Glosa / Detalle */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-secondary dark:text-[#e2bd6c] mb-1.5 ml-1">
                  Detalle / Glosa (Opcional)
                </label>
                <input 
                  type="text"
                  placeholder="Ej: Pasaje Metro estación central, almuerzo durante retiro..."
                  value={gastoForm.descripcion}
                  onChange={e => setGastoForm({ ...gastoForm, descripcion: e.target.value })}
                  className="w-full bg-surface-container dark:bg-[#1f1f1f] border border-outline-variant/20 dark:border-white/10 rounded-2xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Botones de acción */}
              <div className="pt-4 flex justify-end gap-3 border-t border-outline-variant/10 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModalGasto(false)}
                  className="px-5 py-2.5 rounded-2xl border border-outline-variant/20 dark:border-white/10 text-xs font-black uppercase tracking-wider text-outline hover:bg-surface-variant transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingGasto}
                  className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white dark:text-black font-black text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingGasto ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      <span>Guardar Gasto</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ELIMINAR GASTO OPERATIVO ── */}
      {gastoAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface dark:bg-[#141414] border border-outline-variant/20 dark:border-white/10 rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">delete</span>
            </div>
            <h4 className="font-headline font-bold text-lg text-secondary dark:text-white mb-1">
              ¿Eliminar este gasto?
            </h4>
            <p className="text-xs text-outline mb-5">
              Se eliminará el registro de {gastoAEliminar.categoria === 'transporte' ? 'pasajes' : 'comida'} por ${Number(gastoAEliminar.monto).toLocaleString('es-CL')}.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGastoAEliminar(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-xs font-black uppercase text-outline cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminarGasto}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-black uppercase shadow-md cursor-pointer"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
