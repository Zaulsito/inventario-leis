import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getLocalDateString, formatDateDMA } from '../../utils/date';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const COURIERS_POPULARES = [
  'Starken',
  'Chilexpress',
  'Blue Express',
  'Correos Chile',
  'Reparto Propio',
  'Otro'
];

export default function GastosEnvios({ currentOperator = 'Por sistema' }) {
  const [envios, setEnvios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroMes, setFiltroMes] = useState('TODOS');
  
  // Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEnvioId, setEditingEnvioId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modal de Confirmación de Borrado
  const [envioAEliminar, setEnvioAEliminar] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Formulario de Envío
  const initialForm = {
    nombrePedido: '',
    fecha: getLocalDateString(),
    costoEnvio: '',
    courier: 'Starken',
    courierOtro: '',
    productos: [
      { id: 'p_1', nombre: '', cantidad: 1, precio: '' }
    ],
    notas: ''
  };
  const [form, setForm] = useState(initialForm);

  // Escuchar en tiempo real la colección de Firestore 'gastos_envios'
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'gastos_envios'), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordenar por fecha descendente y luego createdAt
      data.sort((a, b) => {
        const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
        const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setEnvios(data);
      setLoading(false);
    }, (err) => {
      console.error("Error al escuchar gastos_envios:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Opciones de meses disponibles a partir de los datos
  const mesesDisponibles = useMemo(() => {
    const set = new Set();
    envios.forEach(e => {
      if (e.fecha && e.fecha.length >= 7) {
        set.add(e.fecha.slice(0, 7)); // YYYY-MM
      }
    });
    return Array.from(set).sort().reverse();
  }, [envios]);

  // Filtrado de envíos
  const enviosFiltrados = useMemo(() => {
    return envios.filter(e => {
      if (filtroMes !== 'TODOS' && (!e.fecha || !e.fecha.startsWith(filtroMes))) {
        return false;
      }
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matchNombre = (e.nombrePedido || '').toLowerCase().includes(s);
        const matchCourier = (e.courier || '').toLowerCase().includes(s);
        const matchNotas = (e.notas || '').toLowerCase().includes(s);
        const matchProds = e.productos && e.productos.some(p => (p.nombre || '').toLowerCase().includes(s));
        if (!(matchNombre || matchCourier || matchNotas || matchProds)) return false;
      }
      return true;
    });
  }, [envios, filtroMes, searchTerm]);

  // Cálculos de KPIs propios
  const totalGastosEnvio = useMemo(() => {
    return enviosFiltrados.reduce((acc, e) => acc + (Number(e.costoEnvio) || 0), 0);
  }, [enviosFiltrados]);

  const totalValorProductos = useMemo(() => {
    return enviosFiltrados.reduce((acc, e) => acc + (Number(e.totalProductos) || 0), 0);
  }, [enviosFiltrados]);

  const totalGeneralAcumulado = useMemo(() => {
    return totalGastosEnvio + totalValorProductos;
  }, [totalGastosEnvio, totalValorProductos]);

  // Manejo de filas dinámicas de productos en el formulario
  const handleAddProducto = () => {
    setForm(prev => ({
      ...prev,
      productos: [
        ...prev.productos,
        { id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, nombre: '', cantidad: 1, precio: '' }
      ]
    }));
  };

  const handleRemoveProducto = (id) => {
    if (form.productos.length <= 1) return;
    setForm(prev => ({
      ...prev,
      productos: prev.productos.filter(p => p.id !== id)
    }));
  };

  const handleProductoChange = (id, field, value) => {
    setForm(prev => ({
      ...prev,
      productos: prev.productos.map(p => {
        if (p.id !== id) return p;
        return { ...p, [field]: value };
      })
    }));
  };

  // Cálculo en vivo de totales del formulario
  const subtotalProductosForm = useMemo(() => {
    return form.productos.reduce((sum, p) => {
      const cant = Number(p.cantidad) || 0;
      const prec = Number(p.precio) || 0;
      return sum + (cant * prec);
    }, 0);
  }, [form.productos]);

  const totalGeneralForm = useMemo(() => {
    const envio = Number(form.costoEnvio) || 0;
    return subtotalProductosForm + envio;
  }, [subtotalProductosForm, form.costoEnvio]);

  // Abrir modal para crear
  const handleOpenNuevo = () => {
    setEditingEnvioId(null);
    setForm(initialForm);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditar = (envio) => {
    setEditingEnvioId(envio.id);
    const courierEsEstandar = COURIERS_POPULARES.includes(envio.courier);
    setForm({
      nombrePedido: envio.nombrePedido || '',
      fecha: envio.fecha || getLocalDateString(),
      costoEnvio: envio.costoEnvio !== undefined ? envio.costoEnvio : '',
      courier: courierEsEstandar ? envio.courier : 'Otro',
      courierOtro: courierEsEstandar ? '' : (envio.courier || ''),
      productos: envio.productos && envio.productos.length > 0 
        ? envio.productos.map(p => ({
            id: p.id || `p_${Math.random()}`,
            nombre: p.nombre || '',
            cantidad: p.cantidad !== undefined ? p.cantidad : 1,
            precio: p.precio !== undefined ? p.precio : ''
          }))
        : [{ id: 'p_1', nombre: '', cantidad: 1, precio: '' }],
      notas: envio.notas || ''
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  // Guardar Envío en Firestore
  const handleGuardarEnvio = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!form.nombrePedido.trim()) {
      setErrorMsg('Por favor ingresa el nombre o referencia del pedido (ej. Pedido de Feyal).');
      return;
    }

    const prodsLimpios = form.productos
      .map(p => ({
        id: p.id,
        nombre: p.nombre.trim(),
        cantidad: Math.max(1, Number(p.cantidad) || 1),
        precio: Math.max(0, Number(p.precio) || 0),
        subtotal: Math.max(1, Number(p.cantidad) || 1) * Math.max(0, Number(p.precio) || 0)
      }))
      .filter(p => p.nombre.length > 0 || p.precio > 0);

    if (prodsLimpios.length === 0) {
      setErrorMsg('Debes añadir al menos un producto con su nombre o precio.');
      return;
    }

    const courierFinal = form.courier === 'Otro' ? (form.courierOtro.trim() || 'Otro') : form.courier;
    const costoEnvioNum = Math.max(0, Number(form.costoEnvio) || 0);
    const totalProdsNum = prodsLimpios.reduce((sum, p) => sum + p.subtotal, 0);
    const totalGralNum = totalProdsNum + costoEnvioNum;

    setSaving(true);
    try {
      const payload = {
        nombrePedido: form.nombrePedido.trim(),
        fecha: form.fecha || getLocalDateString(),
        courier: courierFinal,
        costoEnvio: costoEnvioNum,
        productos: prodsLimpios,
        totalProductos: totalProdsNum,
        totalGeneral: totalGralNum,
        notas: form.notas.trim(),
        usuario: currentOperator,
        updatedAt: new Date().toISOString()
      };

      if (editingEnvioId) {
        await updateDoc(doc(db, 'gastos_envios', editingEnvioId), payload);
      } else {
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, 'gastos_envios'), payload);
      }

      setIsModalOpen(false);
      setEditingEnvioId(null);
    } catch (err) {
      console.error("Error guardando envío:", err);
      setErrorMsg("Ocurrió un error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Confirmar y eliminar envío
  const handleConfirmarEliminar = async () => {
    if (!envioAEliminar) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'gastos_envios', envioAEliminar.id));
      setEnvioAEliminar(null);
    } catch (err) {
      console.error("Error al eliminar envío:", err);
      alert("Error al eliminar: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Exportar a PDF
  const exportarPDF = () => {
    if (enviosFiltrados.length === 0) return alert('No hay datos para exportar.');
    const docPdf = new jsPDF('p', 'mm', 'a4');
    
    // Header corporativo
    docPdf.setFillColor(18, 18, 18);
    docPdf.rect(0, 0, 210, 32, 'F');
    docPdf.setFillColor(226, 189, 108);
    docPdf.rect(0, 32, 210, 2, 'F');

    docPdf.setTextColor(226, 189, 108);
    docPdf.setFont('helvetica', 'bold');
    docPdf.setFontSize(16);
    docPdf.text("INVENTARIO LEIS", 14, 15);

    docPdf.setTextColor(255, 255, 255);
    docPdf.setFontSize(9);
    docPdf.setFont('helvetica', 'normal');
    docPdf.text("INFORME DE GASTOS GENERALES POR ENVÍO Y LOGÍSTICA", 14, 23);

    const tableData = enviosFiltrados.map(e => {
      const prodsStr = (e.productos || []).map(p => `${p.cantidad}x ${p.nombre} ($${(p.precio || 0).toLocaleString('es-CL')})`).join('\n');
      return [
        e.fecha || '',
        e.nombrePedido || '',
        e.courier || '',
        prodsStr || 'Sin detalle',
        `$${(Number(e.costoEnvio) || 0).toLocaleString('es-CL')}`,
        `$${(Number(e.totalProductos) || 0).toLocaleString('es-CL')}`,
        `$${(Number(e.totalGeneral) || 0).toLocaleString('es-CL')}`
      ];
    });

    autoTable(docPdf, {
      startY: 40,
      head: [['FECHA', 'PEDIDO / CLIENTE', 'COURIER', 'PRODUCTOS INCLUIDOS', 'COSTO ENVÍO', 'VALOR PRODS.', 'TOTAL']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [18, 18, 18], textColor: [226, 189, 108], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      foot: [[
        'TOTALES',
        `${enviosFiltrados.length} Envíos`,
        '',
        '',
        `$${totalGastosEnvio.toLocaleString('es-CL')}`,
        `$${totalValorProductos.toLocaleString('es-CL')}`,
        `$${totalGeneralAcumulado.toLocaleString('es-CL')}`
      ]],
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 }
    });

    docPdf.save(`Gastos_Envios_Leis_${getLocalDateString()}.pdf`);
  };

  // Exportar a CSV
  const exportarCSV = () => {
    if (enviosFiltrados.length === 0) return alert('No hay datos para exportar.');
    const rows = [
      ['FECHA', 'PEDIDO / CLIENTE', 'COURIER', 'PRODUCTOS', 'COSTO ENVIO', 'TOTAL PRODUCTOS', 'TOTAL GENERAL', 'NOTAS'],
      ...enviosFiltrados.map(e => [
        e.fecha || '',
        `"${(e.nombrePedido || '').replace(/"/g, '""')}"`,
        `"${(e.courier || '').replace(/"/g, '""')}"`,
        `"${(e.productos || []).map(p => `${p.cantidad}x ${p.nombre} ($${p.precio})`).join(' | ').replace(/"/g, '""')}"`,
        e.costoEnvio || 0,
        e.totalProductos || 0,
        e.totalGeneral || 0,
        `"${(e.notas || '').replace(/"/g, '""')}"`
      ])
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Gastos_Envios_Leis_${getLocalDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      
      {/* ── TARJETAS DE KPIS SUPERIORES (CÁLCULOS EXCLUSIVOS DE ENVÍOS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* KPI 1: Total Gastos de Envío */}
        <div className="p-6 rounded-[2rem] bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/15 dark:border-white/5 shadow-xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">
              Gastos de Envío
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">local_shipping</span>
            </div>
          </div>
          <p className="font-headline text-3xl font-black text-blue-500 tracking-tight">
            ${totalGastosEnvio.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-outline dark:text-gray-400 mt-1">
            Fletes, couriers y transportes
          </p>
        </div>

        {/* KPI 2: Total Valor de Productos */}
        <div className="p-6 rounded-[2rem] bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/15 dark:border-white/5 shadow-xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e2bd6c]">
              Valor Productos
            </span>
            <div className="w-9 h-9 rounded-xl bg-[#e2bd6c]/10 text-[#e2bd6c] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">shopping_bag</span>
            </div>
          </div>
          <p className="font-headline text-3xl font-black text-on-surface dark:text-[#e2bd6c] tracking-tight">
            ${totalValorProductos.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-outline dark:text-gray-400 mt-1">
            Monto de mercancía enviada
          </p>
        </div>

        {/* KPI 3: Monto Total Acumulado */}
        <div className="p-6 rounded-[2rem] bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/15 dark:border-white/5 shadow-xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              Total General
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
          </div>
          <p className="font-headline text-3xl font-black text-emerald-500 tracking-tight">
            ${totalGeneralAcumulado.toLocaleString('es-CL')}
          </p>
          <p className="text-[11px] text-outline dark:text-gray-400 mt-1">
            Suma neta (Productos + Envío)
          </p>
        </div>

        {/* KPI 4: Envíos Registrados */}
        <div className="p-6 rounded-[2rem] bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/15 dark:border-white/5 shadow-xl relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
              Envíos Registrados
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
          </div>
          <p className="font-headline text-3xl font-black text-on-surface dark:text-white tracking-tight">
            {enviosFiltrados.length}
          </p>
          <p className="text-[11px] text-outline dark:text-gray-400 mt-1">
            Paquetes y órdenes despachadas
          </p>
        </div>

      </div>

      {/* ── BARRA DE HERRAMIENTAS, FILTROS Y BOTÓN AGREGAR ── */}
      <div className="p-5 md:p-6 rounded-[2.5rem] bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/15 dark:border-white/5 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Búsqueda y Filtro de Mes */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
          {/* Búsqueda */}
          <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por pedido, producto o courier..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface-container dark:bg-black/30 border border-outline-variant/20 dark:border-white/10 text-xs text-on-surface dark:text-white focus:outline-none focus:border-[#e2bd6c]/50 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro por Mes */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline dark:text-gray-400 hidden sm:inline">
              Mes:
            </span>
            <select
              value={filtroMes}
              onChange={e => setFiltroMes(e.target.value)}
              className="py-2.5 px-3 rounded-2xl bg-surface-container dark:bg-black/30 border border-outline-variant/20 dark:border-white/10 text-xs font-bold text-on-surface dark:text-white focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos los meses</option>
              {mesesDisponibles.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Botones de Acción: Exportar y Agregar */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={exportarPDF}
            title="Exportar a PDF"
            className="p-2.5 rounded-2xl border border-outline-variant/20 dark:border-white/10 text-on-surface dark:text-gray-300 hover:bg-white/5 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            <span className="material-symbols-outlined text-base text-red-400">picture_as_pdf</span>
            <span className="hidden sm:inline">PDF</span>
          </button>

          <button
            type="button"
            onClick={exportarCSV}
            title="Exportar a Excel / CSV"
            className="p-2.5 rounded-2xl border border-outline-variant/20 dark:border-white/10 text-on-surface dark:text-gray-300 hover:bg-white/5 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            <span className="material-symbols-outlined text-base text-emerald-400">table_view</span>
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenNuevo}
            className="px-5 py-2.5 rounded-2xl bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black font-headline font-bold text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg font-black">add</span>
            <span>Agregar Envío</span>
          </button>
        </div>

      </div>

      {/* ── LISTADO DE ENVÍOS REGISTRADOS ── */}
      {loading ? (
        <div className="text-center py-20 text-outline dark:text-gray-400 flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-4xl animate-spin text-[#e2bd6c]">progress_activity</span>
          <p className="text-sm font-bold uppercase tracking-wider">Cargando registros de envíos...</p>
        </div>
      ) : enviosFiltrados.length === 0 ? (
        <div className="text-center py-20 rounded-[2.5rem] bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/15 dark:border-white/5 p-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#e2bd6c]/10 text-[#e2bd6c] flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">local_shipping</span>
          </div>
          <h4 className="font-headline text-xl font-bold text-on-surface dark:text-white">
            No hay registros de envíos
          </h4>
          <p className="text-xs text-outline dark:text-gray-400 max-w-md">
            Registra los gastos de logística y transporte de tus pedidos para llevar el control financiero de cada entrega.
          </p>
          <button
            type="button"
            onClick={handleOpenNuevo}
            className="mt-2 px-6 py-2.5 rounded-2xl bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black font-bold text-xs uppercase tracking-wider shadow-md hover:scale-105 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span>
            <span>Registrar Primer Envío</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {enviosFiltrados.map((envio) => {
            return (
              <div
                key={envio.id}
                className="p-6 rounded-[2rem] bg-surface-container-low dark:bg-[#1a1a1a] border border-outline-variant/15 dark:border-white/5 shadow-xl flex flex-col justify-between gap-5 group hover:border-[#e2bd6c]/30 transition-all"
              >
                {/* Cabecera de la Tarjeta */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {envio.courier || 'Envío'}
                        </span>
                        <span className="text-[10px] text-outline dark:text-gray-400 font-bold">
                          📅 {formatDateDMA(envio.fecha)}
                        </span>
                      </div>
                      <h4 className="font-headline text-lg md:text-xl font-bold text-on-surface dark:text-white">
                        {envio.nombrePedido}
                      </h4>
                    </div>

                    {/* Acciones: Editar / Eliminar */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditar(envio)}
                        title="Editar Envío"
                        className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnvioAEliminar(envio)}
                        title="Eliminar Envío"
                        className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Lista de Productos Incluidos */}
                  <div className="mt-4 pt-3 border-t border-outline-variant/10 dark:border-white/5 space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#e2bd6c]/80 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">inventory_2</span>
                      Productos en el Envío ({envio.productos?.length || 0}):
                    </p>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      {(envio.productos || []).map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-surface-container dark:bg-black/20">
                          <span className="truncate pr-2 font-medium text-on-surface dark:text-gray-200">
                            <strong className="text-secondary dark:text-[#e2bd6c]">{p.cantidad}x</strong> {p.nombre || 'Producto'}
                          </span>
                          <span className="font-bold text-outline dark:text-gray-300 shrink-0">
                            ${(Number(p.subtotal) || (Number(p.precio) * Number(p.cantidad)) || 0).toLocaleString('es-CL')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notas si existen */}
                  {envio.notas && (
                    <p className="text-[11px] text-outline dark:text-gray-400 italic mt-3 bg-surface-container dark:bg-black/20 p-2.5 rounded-xl border border-outline-variant/10 dark:border-white/5">
                      "{envio.notas}"
                    </p>
                  )}
                </div>

                {/* Pie con Desglose Financiero */}
                <div className="pt-4 border-t border-outline-variant/10 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-3 text-xs">
                    <div>
                      <span className="block text-[9px] uppercase tracking-wider text-outline dark:text-gray-400 font-bold">Costo Envío</span>
                      <span className="font-bold text-blue-500">+${(Number(envio.costoEnvio) || 0).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="h-6 w-px bg-outline-variant/20 dark:bg-white/10" />
                    <div>
                      <span className="block text-[9px] uppercase tracking-wider text-outline dark:text-gray-400 font-bold">Subtotal Prods.</span>
                      <span className="font-bold text-on-surface dark:text-gray-200">${(Number(envio.totalProductos) || 0).toLocaleString('es-CL')}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="block text-[9px] uppercase tracking-wider text-emerald-500 font-bold">Total del Pedido</span>
                    <span className="font-headline text-xl font-black text-emerald-500">
                      ${(Number(envio.totalGeneral) || 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ── MODAL AGREGAR / EDITAR ENVÍO ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xl my-8 rounded-[2.5rem] bg-surface dark:bg-[#181818] border border-outline-variant/20 dark:border-white/10 shadow-2xl p-6 md:p-8 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Cabecera Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-outline-variant/15 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">local_shipping</span>
                </div>
                <div>
                  <h3 className="font-headline text-xl font-bold text-on-surface dark:text-white">
                    {editingEnvioId ? 'Editar Registro de Envío' : 'Agregar Nuevo Envío'}
                  </h3>
                  <p className="text-[10px] uppercase tracking-widest text-outline dark:text-[#e2bd6c]/70 font-bold">
                    Control logístico y de fletes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Contenido con Scroll */}
            <form onSubmit={handleGuardarEnvio} className="flex-1 overflow-y-auto py-5 space-y-5 custom-scrollbar pr-1">
              
              {/* Alerta de error si existe */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold animate-in fade-in">
                  ⚠️ {errorMsg}
                </div>
              )}

              {/* 1. Nombre / Referencia del Pedido */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-outline dark:text-gray-300 mb-1.5">
                  Nombre / Referencia del Pedido *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pedido de Feyal, Envío #1042..."
                  value={form.nombrePedido}
                  onChange={e => setForm({ ...form, nombrePedido: e.target.value })}
                  className="w-full px-4 py-3 rounded-2xl bg-surface-container dark:bg-black/30 border border-outline-variant/20 dark:border-white/10 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:border-[#e2bd6c]/50 transition-all"
                />
              </div>

              {/* 2. Fecha y Courier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-outline dark:text-gray-300 mb-1.5">
                    Fecha del Envío
                  </label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={e => setForm({ ...form, fecha: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-container dark:bg-black/30 border border-outline-variant/20 dark:border-white/10 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:border-[#e2bd6c]/50 transition-all cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-outline dark:text-gray-300 mb-1.5">
                    Empresa / Courier
                  </label>
                  <select
                    value={form.courier}
                    onChange={e => setForm({ ...form, courier: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-container dark:bg-black/30 border border-outline-variant/20 dark:border-white/10 text-xs font-bold text-on-surface dark:text-white focus:outline-none cursor-pointer"
                  >
                    {COURIERS_POPULARES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Courier Otro si seleccionó 'Otro' */}
              {form.courier === 'Otro' && (
                <div className="animate-in fade-in">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-outline dark:text-gray-300 mb-1.5">
                    Especificar Courier o Transporte
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Delivery Particular, Varmontt..."
                    value={form.courierOtro}
                    onChange={e => setForm({ ...form, courierOtro: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-surface-container dark:bg-black/30 border border-outline-variant/20 dark:border-white/10 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:border-[#e2bd6c]/50 transition-all"
                  />
                </div>
              )}

              {/* 3. Costo del Envío */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-1.5 flex items-center justify-between">
                  <span>Costo de Envío ($)</span>
                  <span className="text-[10px] text-gray-400 font-normal">Gasto exclusivo de flete</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-blue-500 font-bold">$</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ej: 5000"
                    value={form.costoEnvio}
                    onChange={e => setForm({ ...form, costoEnvio: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 rounded-2xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/30 text-xs font-black text-blue-500 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* 4. Lista Dinámica de Productos */}
              <div className="pt-3 border-t border-outline-variant/15 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#e2bd6c] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">inventory_2</span>
                    Productos Incluidos en el Pedido
                  </label>
                  <button
                    type="button"
                    onClick={handleAddProducto}
                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-xl bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] hover:bg-[#e2bd6c]/20 border border-[#e2bd6c]/20 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">add</span>
                    Añadir otro producto
                  </button>
                </div>

                <div className="space-y-2.5">
                  {form.productos.map((prod, index) => {
                    const rowSubtotal = (Number(prod.cantidad) || 0) * (Number(prod.precio) || 0);
                    return (
                      <div 
                        key={prod.id}
                        className="p-3 rounded-2xl bg-surface-container dark:bg-black/25 border border-outline-variant/15 dark:border-white/5 flex flex-col sm:flex-row items-center gap-2.5"
                      >
                        {/* Nombre del Producto */}
                        <div className="flex-1 w-full">
                          <input
                            type="text"
                            placeholder={`Producto #${index + 1} (ej. Crema Collagen)`}
                            value={prod.nombre}
                            onChange={e => handleProductoChange(prod.id, 'nombre', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-surface dark:bg-[#121212] border border-outline-variant/15 dark:border-white/10 text-xs font-medium text-on-surface dark:text-white focus:outline-none focus:border-[#e2bd6c]/50 transition-all"
                          />
                        </div>

                        {/* Cantidad */}
                        <div className="w-20 shrink-0">
                          <input
                            type="number"
                            min="1"
                            title="Cantidad"
                            placeholder="Cant."
                            value={prod.cantidad}
                            onChange={e => handleProductoChange(prod.id, 'cantidad', e.target.value)}
                            className="w-full px-2 py-2 rounded-xl bg-surface dark:bg-[#121212] border border-outline-variant/15 dark:border-white/10 text-xs font-bold text-center text-on-surface dark:text-white focus:outline-none"
                          />
                        </div>

                        {/* Precio Unitario */}
                        <div className="w-28 shrink-0 relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Precio c/u"
                            value={prod.precio}
                            onChange={e => handleProductoChange(prod.id, 'precio', e.target.value)}
                            className="w-full pl-6 pr-2 py-2 rounded-xl bg-surface dark:bg-[#121212] border border-outline-variant/15 dark:border-white/10 text-xs font-bold text-right text-on-surface dark:text-white focus:outline-none"
                          />
                        </div>

                        {/* Subtotal Fila */}
                        <div className="w-24 text-right shrink-0">
                          <span className="text-[11px] font-black text-on-surface dark:text-[#e2bd6c]">
                            ${rowSubtotal.toLocaleString('es-CL')}
                          </span>
                        </div>

                        {/* Botón Eliminar Fila */}
                        <button
                          type="button"
                          disabled={form.productos.length <= 1}
                          onClick={() => handleRemoveProducto(prod.id)}
                          title="Eliminar producto"
                          className="w-7 h-7 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-20 shrink-0 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Notas opcionales */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-outline dark:text-gray-300 mb-1.5">
                  Notas u Observaciones (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Número de seguimiento, embalaje especial..."
                  value={form.notas}
                  onChange={e => setForm({ ...form, notas: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-surface-container dark:bg-black/30 border border-outline-variant/20 dark:border-white/10 text-xs text-on-surface dark:text-white focus:outline-none"
                />
              </div>

              {/* ── RESUMEN FINANCIERO EN VIVO DEL ENVÍO ── */}
              <div className="p-4 rounded-2xl bg-[#e2bd6c]/5 border border-[#e2bd6c]/20 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-outline dark:text-gray-400">Subtotal Productos:</span>
                  <span className="font-bold text-on-surface dark:text-white">${subtotalProductosForm.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-blue-500 font-bold">+ Costo de Envío:</span>
                  <span className="font-bold text-blue-500">${(Number(form.costoEnvio) || 0).toLocaleString('es-CL')}</span>
                </div>
                <div className="pt-2 border-t border-[#e2bd6c]/20 flex justify-between items-center">
                  <span className="font-headline font-black text-sm uppercase text-secondary dark:text-[#e2bd6c]">Total del Pedido:</span>
                  <span className="font-headline font-black text-xl text-emerald-500">${totalGeneralForm.toLocaleString('es-CL')}</span>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="pt-4 border-t border-outline-variant/15 dark:border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-2xl border border-outline-variant/20 dark:border-white/10 text-xs font-bold text-outline dark:text-gray-300 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-2xl bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black font-headline font-bold text-xs uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  <span>{saving ? 'Guardando...' : (editingEnvioId ? 'Actualizar Envío' : 'Guardar Envío')}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMAR ELIMINACIÓN ── */}
      {envioAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-sm rounded-[2rem] bg-surface dark:bg-[#1a1a1a] border border-red-500/30 p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <h4 className="font-headline text-lg font-bold text-on-surface dark:text-white">
              ¿Eliminar este registro de envío?
            </h4>
            <p className="text-xs text-outline dark:text-gray-400">
              Estás a punto de borrar el registro de <strong className="text-white">"{envioAEliminar.nombrePedido}"</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEnvioAEliminar(null)}
                className="px-4 py-2 rounded-xl border border-outline-variant/20 dark:border-white/10 text-xs font-bold text-gray-300 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmarEliminar}
                className="px-4 py-2 rounded-xl bg-red-500 text-white font-bold text-xs shadow-md hover:bg-red-600 transition-colors"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
