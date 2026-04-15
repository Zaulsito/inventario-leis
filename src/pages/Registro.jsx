// src/pages/Registro.jsx
import { useState } from 'react'

const productosDisponibles = [
  'Aceite de Oro Rosa',
  'Sérum Regenerador Nocturno',
  'Crema Hidratante Esencial',
  'Tónico Esencial Rosas',
  'Bálsamo Labial Heritage',
  'Mascarilla Renovadora',
  'Agua Micelar Purificante',
]

const historialInicial = [
  { producto: 'Crema Hidratante Esencial', fecha: 'Hace 2h',   proveedor: 'DistCorp',  qty: 120 },
  { producto: 'Aceite de Oro Rosa',        fecha: 'Ayer',      proveedor: 'NaturaPro', qty: 48  },
  { producto: 'Mascarilla Renovadora',     fecha: 'Lunes',     proveedor: 'BelCo',     qty: 96  },
]

function Campo({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-secondary pl-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full bg-surface-container border-0 border-b-2 border-outline-variant/30 focus:border-primary focus:outline-none px-4 py-3.5 text-on-surface font-body rounded-t-xl transition-all text-sm'

export default function Registro() {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    producto:   productosDisponibles[0],
    cantidad:   '',
    fecha:      today,
    proveedor:  '',
    nota:       '',
  })
  const [historial, setHistorial] = useState(historialInicial)
  const [enviado, setEnviado]     = useState(false)

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit() {
    if (!form.cantidad || Number(form.cantidad) <= 0) return
    const nuevo = {
      producto:  form.producto,
      fecha:     'Ahora',
      proveedor: form.proveedor || '—',
      qty:       Number(form.cantidad),
    }
    setHistorial(h => [nuevo, ...h])
    setForm(f => ({ ...f, cantidad: '', proveedor: '', nota: '' }))
    setEnviado(true)
    setTimeout(() => setEnviado(false), 2500)
  }

  return (
    <div className="p-8 md:p-12">

      {/* Header */}
      <header className="flex justify-between items-start mb-10">
        <div>
          <h1 className="font-headline italic text-4xl text-on-tertiary-fixed-variant">Registro</h1>
          <p className="text-secondary font-label text-xs uppercase tracking-[0.2em] mt-1">Gestión de Ingresos al Inventario</p>
        </div>
        <div className="flex gap-3">
          <button className="w-11 h-11 rounded-full border border-outline-variant/30 flex items-center justify-center hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          </button>
          <button className="w-11 h-11 rounded-full border border-outline-variant/30 flex items-center justify-center hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">settings</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">

        {/* ── Formulario ── */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-[2rem] p-8 shadow-[0_32px_64px_-12px_rgba(93,58,42,0.06)] border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-8">
            <span className="w-7 h-[2px] bg-primary inline-block" />
            <h2 className="text-2xl font-headline text-on-surface">Nuevo Ingreso</h2>
          </div>

          <div className="space-y-6">
            {/* Producto */}
            <Campo label="Producto">
              <select name="producto" value={form.producto} onChange={handleChange} className={inputCls}>
                {productosDisponibles.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Campo>

            {/* Cantidad + Fecha */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Campo label="Cantidad">
                <input
                  name="cantidad"
                  type="number"
                  min="1"
                  value={form.cantidad}
                  onChange={handleChange}
                  placeholder="0"
                  className={inputCls}
                />
              </Campo>
              <Campo label="Fecha de ingreso">
                <input
                  name="fecha"
                  type="date"
                  value={form.fecha}
                  onChange={handleChange}
                  className={inputCls}
                />
              </Campo>
            </div>

            {/* Proveedor */}
            <Campo label="Proveedor (opcional)">
              <input
                name="proveedor"
                type="text"
                value={form.proveedor}
                onChange={handleChange}
                placeholder="Nombre del proveedor"
                className={inputCls}
              />
            </Campo>

            {/* Nota */}
            <Campo label="Nota u observación">
              <textarea
                name="nota"
                value={form.nota}
                onChange={handleChange}
                rows={3}
                placeholder="Información adicional del lote..."
                className={`${inputCls} resize-none`}
              />
            </Campo>

            {/* Adjuntar */}
            <div className="w-full border-2 border-dashed border-outline-variant/40 rounded-2xl p-7 flex flex-col items-center justify-center gap-2 bg-surface/50 hover:bg-surface-variant/30 transition-colors cursor-pointer group">
              <span className="material-symbols-outlined text-primary text-4xl group-hover:scale-110 transition-transform">upload_file</span>
              <p className="text-sm font-semibold text-on-surface-variant">Adjuntar documento (opcional)</p>
              <p className="text-xs text-outline">PDF, JPG o PNG hasta 10MB</p>
            </div>

            {/* Botón */}
            <div className="flex justify-end pt-2">
              {enviado && (
                <span className="flex items-center gap-2 text-sm text-green-700 font-bold mr-4">
                  <span className="material-symbols-outlined text-green-700">check_circle</span>
                  Ingreso registrado
                </span>
              )}
              <button
                onClick={handleSubmit}
                className="bg-primary-container text-on-primary-container px-10 py-4 rounded-xl font-bold uppercase tracking-widest text-sm shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
              >
                Registrar Ingreso
              </button>
            </div>
          </div>
        </div>

        {/* ── Historial ── */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-7 h-[2px] bg-secondary inline-block" />
              <h2 className="text-2xl font-headline text-on-surface">Historial Reciente</h2>
            </div>
            <button className="text-[10px] font-bold text-secondary uppercase tracking-widest hover:underline">Ver Todo</button>
          </div>

          <div className="space-y-3">
            {historial.map((item, i) => (
              <div
                key={i}
                className="group bg-surface-container-low hover:bg-surface-container-high transition-all duration-300 rounded-3xl p-5 flex gap-4 items-center border border-transparent hover:border-outline-variant/20"
              >
                <div className="w-14 h-14 rounded-2xl bg-surface-container-highest flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary">inventory_2</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-secondary uppercase tracking-[0.12em] mb-0.5">{item.fecha}</p>
                  <h3 className="text-base font-headline leading-tight text-on-surface truncate">{item.producto}</h3>
                  <p className="text-xs text-on-surface-variant">{item.proveedor}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-primary font-bold text-lg">+{item.qty}</p>
                  <p className="text-[10px] text-outline">unidades</p>
                </div>
              </div>
            ))}
          </div>

          {/* Info card */}
          <div className="mt-4 bg-on-tertiary-fixed-variant text-surface-container-low rounded-[2rem] p-7 relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-headline text-lg italic mb-2">Gestión de Stock</h4>
              <p className="text-sm font-light opacity-80 leading-relaxed mb-5">
                Cada ingreso registrado actualiza automáticamente el stock disponible en inventario.
              </p>
              <button className="inline-flex items-center gap-2 text-primary-container font-bold text-xs uppercase tracking-widest hover:gap-4 transition-all">
                Ver inventario completo
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
            <span className="material-symbols-outlined absolute -bottom-6 -right-6 text-[110px] opacity-5 pointer-events-none">
              verified_user
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
