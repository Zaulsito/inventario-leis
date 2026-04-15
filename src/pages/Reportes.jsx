// src/pages/Reportes.jsx
import { useState } from 'react'

const SEMANAS = ['Semana 15 · 7–13 Abr', 'Semana 14 · 31 Mar–6 Abr', 'Semana 13 · 24–30 Mar']

const conteoInicial = [
  { producto: 'Aceite de Oro Rosa',        stockIni: 460,  vendido: 32,  stockFin: 428 },
  { producto: 'Sérum Regenerador Nocturno',stockIni: 40,   vendido: 32,  stockFin: 8   },
  { producto: 'Crema Hidratante Esencial', stockIni: 1190, vendido: 70,  stockFin: 1120 },
  { producto: 'Tónico Esencial Rosas',     stockIni: 50,   vendido: 26,  stockFin: 24  },
  { producto: 'Mascarilla Renovadora',     stockIni: 110,  vendido: 18,  stockFin: 92  },
  { producto: 'Agua Micelar Purificante',  stockIni: 340,  vendido: 30,  stockFin: 310 },
]

const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const barras = [35, 55, 45, 80, 60, 75, 40]

export default function Reportes() {
  const [semana, setSemana]   = useState(0)
  const [conteo, setConteo]   = useState(conteoInicial)
  const [guardado, setGuardado] = useState(false)

  function handleVendido(i, val) {
    setConteo(c => c.map((item, idx) => {
      if (idx !== i) return item
      const v = Math.max(0, Number(val))
      return { ...item, vendido: v, stockFin: item.stockIni - v }
    }))
  }

  function guardar() {
    setGuardado(true)
    setTimeout(() => setGuardado(false), 2500)
  }

  const totalVendido = conteo.reduce((a, p) => a + p.vendido, 0)
  const bajoStock    = conteo.filter(p => p.stockFin < 20).length
  const saludable    = conteo.filter(p => p.stockFin >= 20).length
  const maxBarra     = Math.max(...barras)

  return (
    <div className="p-8 md:p-10">

      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-1 block">Análisis de Desempeño</span>
          <h2 className="font-headline text-4xl md:text-5xl text-on-tertiary-fixed-variant leading-tight">Informe Semanal</h2>
          <p className="mt-3 text-outline font-body max-w-lg leading-relaxed text-sm">
            Resumen de inventario y ventas para la {SEMANAS[semana]}.
          </p>
        </div>
        <div className="flex gap-3">
          {/* Selector de semana */}
          <select
            value={semana}
            onChange={e => setSemana(Number(e.target.value))}
            className="bg-surface-container-highest px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border-0 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
          >
            {SEMANAS.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
          <button className="bg-surface-container-highest px-5 py-2.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest text-on-surface hover:bg-surface-variant transition-colors">
            Exportar PDF
          </button>
          <button className="bg-primary-container text-on-primary-container px-7 py-2.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
            Generar Reporte
          </button>
        </div>
      </header>

      {/* Bento grid */}
      <section className="grid grid-cols-12 gap-5 mb-10">

        {/* Gráfico hero */}
        <div className="col-span-12 lg:col-span-8 bg-surface-container-low rounded-3xl p-8 relative overflow-hidden group border border-outline-variant/10">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-8 gap-3 relative z-10">
            <div>
              <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Ventas de la Semana</h3>
              <p className="text-xs text-outline font-label uppercase tracking-widest mt-0.5">Tendencia de salidas diarias</p>
            </div>
            <div className="bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-outline-variant/20 flex items-center gap-2 self-start">
              <span className="w-2 h-2 rounded-full bg-primary-container inline-block" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">+12.4% vs semana anterior</span>
            </div>
          </div>

          {/* Barras */}
          <div className="h-52 flex items-end gap-3 px-2 relative z-10">
            {barras.map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t-xl transition-all duration-700 ${i === 3 ? 'bg-primary-container' : i === 6 ? 'bg-secondary' : 'bg-surface-container-highest hover:bg-primary/20'}`}
                  style={{ height: `${(h / maxBarra) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between px-2 mt-4 text-[10px] font-bold uppercase tracking-widest text-outline">
            {diasSemana.map(d => <span key={d}>{d.slice(0, 3)}</span>)}
          </div>

          <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Estado de stock */}
        <div className="col-span-12 lg:col-span-4 bg-surface-container-highest rounded-3xl p-8 flex flex-col justify-between border border-outline-variant/10">
          <div>
            <h3 className="font-headline text-xl text-on-tertiary-fixed-variant">Estado de Stock</h3>
            <p className="text-xs text-outline font-label uppercase tracking-widest mt-0.5">Alertas de reposición</p>
          </div>
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center border border-outline-variant/20 shadow-sm shrink-0">
                <span className="material-symbols-outlined text-secondary">priority_high</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Bajo Stock</p>
                <p className="font-headline text-lg text-on-tertiary-fixed-variant">{bajoStock} Productos</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center border border-outline-variant/20 shadow-sm shrink-0">
                <span className="material-symbols-outlined text-primary">check_circle</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Saludable</p>
                <p className="font-headline text-lg text-on-tertiary-fixed-variant">{saludable} Productos</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full h-2 bg-white rounded-full overflow-hidden">
              <div className="bg-primary-container h-full rounded-full" style={{ width: `${Math.round((saludable / conteo.length) * 100)}%` }} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-2">
              {Math.round((saludable / conteo.length) * 100)}% productos en estado saludable
            </p>
          </div>
        </div>
      </section>

      {/* Tabla de conteo semanal */}
      <section className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-3">
          <div>
            <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Conteo Semanal de Ventas</h3>
            <p className="text-xs text-outline font-label uppercase tracking-widest mt-0.5">
              Total vendido esta semana: <strong className="text-secondary">{totalVendido} unidades</strong>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {guardado && (
              <span className="flex items-center gap-1 text-xs text-green-700 font-bold">
                <span className="material-symbols-outlined text-green-700 text-sm">check_circle</span>
                Guardado
              </span>
            )}
            <button
              onClick={guardar}
              className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-sm"
            >
              Guardar conteo
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[580px]">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {['Producto', 'Stock inicial', 'Vendido esta semana', 'Stock final'].map(h => (
                  <th key={h} className="pb-5 font-label text-[10px] font-bold uppercase tracking-widest text-outline pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {conteo.map((p, i) => (
                <tr key={p.producto} className="group hover:bg-surface-container-high transition-colors">
                  <td className="py-5 pr-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-sm">inventory_2</span>
                      </div>
                      <span className="font-headline text-on-tertiary-fixed-variant text-sm">{p.producto}</span>
                    </div>
                  </td>
                  <td className="py-5 pr-6 font-body text-sm font-semibold">{p.stockIni.toLocaleString()}</td>
                  <td className="py-5 pr-6">
                    <input
                      type="number"
                      min="0"
                      max={p.stockIni}
                      value={p.vendido}
                      onChange={e => handleVendido(i, e.target.value)}
                      className="w-20 bg-surface border border-outline-variant/30 rounded-lg px-3 py-1.5 text-sm font-bold text-on-surface focus:outline-none focus:border-primary text-center"
                    />
                  </td>
                  <td className="py-5">
                    <span className={`font-body text-sm font-bold ${p.stockFin < 20 ? 'text-error' : 'text-on-surface'}`}>
                      {p.stockFin.toLocaleString()}
                    </span>
                    {p.stockFin < 20 && (
                      <span className="ml-2 material-symbols-outlined text-error text-sm align-middle">warning</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-7 pt-7 border-t border-outline-variant/20 flex justify-center">
          <button className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary hover:text-secondary transition-colors flex items-center gap-2">
            Ver inventario completo
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 flex justify-between items-center opacity-40">
        <div className="flex items-center gap-4">
          <span className="h-px w-10 bg-outline inline-block" />
          <p className="font-label text-[10px] uppercase tracking-widest">Inventario App © 2026</p>
        </div>
        <span className="font-label text-[10px] uppercase tracking-widest">Confidencial</span>
      </footer>
    </div>
  )
}
