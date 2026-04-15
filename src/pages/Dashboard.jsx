// src/pages/Dashboard.jsx
// Datos de ejemplo — se reemplazarán con Firestore

const metricas = [
  { icon: 'trending_up',  label: 'Ventas totales',  valor: '$124.500',  sub: 'Últimos 30 días' },
  { icon: 'inventory',    label: 'Stock actual',     valor: '1.240',     sub: 'unidades' },
  { icon: 'move_to_inbox',label: 'Ingresado',        valor: '480',       sub: 'Esta semana' },
  { icon: 'shopping_bag', label: 'Vendido',          valor: '312',       sub: 'Esta semana' },
]

const bajosDeStock = [
  { nombre: 'Serum Vitamina C+',     categoria: 'Tratamiento Facial', stock: 12, min: 50,  nivel: 'critico' },
  { nombre: 'Tónico Esencial Rosas', categoria: 'Limpieza',           stock: 24, min: 40,  nivel: 'bajo' },
  { nombre: 'Bálsamo Labial',        categoria: 'Cuidado Labial',     stock: 5,  min: 20,  nivel: 'critico' },
]

const ultimosIngresos = [
  { producto: 'Crema Hidratante Esencial', fecha: 'Hoy · 09:32',    proveedor: 'DistCorp',  qty: '+120' },
  { producto: 'Serum Vitamina C+',         fecha: 'Ayer · 14:10',   proveedor: 'BelCo',     qty: '+96' },
  { producto: 'Aceite de Rosa',            fecha: 'Lun 13 · 11:00', proveedor: 'NaturaPro', qty: '+48' },
]

const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const entradas   = [35, 55, 45, 80, 60, 75]
const salidas    = [50, 30, 60, 20, 45, 35]

function BadgeStock({ nivel }) {
  const cls = nivel === 'critico'
    ? 'bg-error/10 text-error'
    : 'bg-secondary-container/20 text-secondary'
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${cls}`}>
      {nivel === 'critico' ? 'Crítico' : 'Stock bajo'}
    </span>
  )
}

export default function Dashboard() {
  return (
    <div className="p-6 md:p-12">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 gap-4">
        <div>
          <p className="text-secondary font-label text-xs font-bold uppercase tracking-[0.2em] mb-1">Resumen General</p>
          <h1 className="font-headline italic text-4xl md:text-5xl text-primary leading-tight">Panel de Control</h1>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-3 bg-surface-container-highest text-on-surface rounded-xl font-bold text-xs tracking-wide hover:bg-surface-variant transition-colors">
            <span className="material-symbols-outlined text-xl">calendar_today</span>
            Últimos 30 días
          </button>
          <button className="flex items-center gap-2 px-5 py-3 bg-primary-container text-on-primary-container rounded-xl font-bold text-xs tracking-wide shadow-lg hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-xl">add</span>
            Nuevo Registro
          </button>
        </div>
      </header>

      {/* Métricas */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {metricas.map((m) => (
          <div key={m.label} className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between h-40">
            <span className="material-symbols-outlined text-secondary text-3xl">{m.icon}</span>
            <div>
              <p className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest mb-1">{m.label}</p>
              <p className="text-2xl font-headline font-bold text-primary">{m.valor}</p>
              <p className="text-[10px] text-on-surface-variant">{m.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Gráfico + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

        {/* Gráfico barras */}
        <div className="lg:col-span-2 p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-headline italic text-2xl text-primary">Movimientos Recientes</h2>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" /> Salidas</span>
            </div>
          </div>

          <div className="h-48 flex items-end justify-between gap-3 px-2 mb-6">
            {diasSemana.map((dia, i) => (
              <div key={dia} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-primary/25 rounded-t-lg hover:bg-primary/40 transition-colors"
                  style={{ height: `${entradas[i]}%` }}
                />
                <div
                  className="w-full bg-secondary/40 rounded-t-lg"
                  style={{ height: `${salidas[i]}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between px-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {diasSemana.map(d => <span key={d}>{d}</span>)}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
          {/* Alerta */}
          <div className="p-7 rounded-3xl bg-secondary text-white relative overflow-hidden">
            <h3 className="font-headline text-xl mb-3 relative z-10">Alerta de Stock</h3>
            <p className="text-sm opacity-80 mb-5 relative z-10">5 productos han alcanzado el nivel crítico de reposición.</p>
            <button className="px-5 py-2 bg-primary-container text-on-primary-container rounded-full font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform relative z-10 shadow-lg">
              Gestionar
            </button>
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <span className="material-symbols-outlined text-[120px]">warning</span>
            </div>
          </div>

          {/* Próximas entregas */}
          <div className="p-7 rounded-3xl bg-surface-container-low border border-outline-variant/20">
            <h4 className="font-label font-bold text-[10px] uppercase tracking-[0.15em] text-on-surface-variant mb-5">Próximas Entregas</h4>
            <div className="space-y-4">
              {[
                { nombre: 'Crema Renovadora', fecha: 'Mañana, 10:00 AM' },
                { nombre: 'Serum Vitamina C+', fecha: '18 Abr, 2:00 PM' },
              ].map(e => (
                <div key={e.nombre} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-surface-variant flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">local_shipping</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">{e.nombre}</p>
                    <p className="text-xs text-on-surface-variant">{e.fecha}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla stock bajo */}
      <section className="mb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-headline italic text-3xl text-primary">Inventario Bajo en Stock</h2>
          <button className="text-secondary font-label text-xs font-bold uppercase tracking-widest hover:underline decoration-2 underline-offset-8">
            Ver todo el catálogo
          </button>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-surface-container-high/50">
                {['Producto', 'Categoría', 'Stock actual', 'Umbral mín.', 'Acción'].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {bajosDeStock.map(p => (
                <tr key={p.nombre} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-sm">inventory_2</span>
                      </div>
                      <span className="font-headline font-bold text-on-surface">{p.nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">{p.categoria}</td>
                  <td className="px-6 py-5">
                    <BadgeStock nivel={p.nivel} />
                    <span className="ml-2 text-sm font-bold">{p.stock} u.</span>
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">{p.min}</td>
                  <td className="px-6 py-5">
                    <button className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-primary-container/20 rounded-full">
                      shopping_cart_checkout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Últimos ingresos */}
      <section>
        <h2 className="font-headline italic text-2xl text-primary mb-5">Últimos Ingresos</h2>
        <div className="space-y-3">
          {ultimosIngresos.map(i => (
            <div key={i.producto} className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/20 hover:bg-surface-container transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm">move_to_inbox</span>
                </div>
                <div>
                  <p className="font-bold text-sm text-on-surface">{i.producto}</p>
                  <p className="text-xs text-on-surface-variant">{i.fecha} · {i.proveedor}</p>
                </div>
              </div>
              <span className="font-headline font-bold text-primary text-lg">{i.qty}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
