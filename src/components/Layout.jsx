import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard',  icon: 'dashboard',        label: 'Panel' },
  { to: '/inventario', icon: 'inventory_2',       label: 'Inventario' },
  { to: '/registro',   icon: 'app_registration',  label: 'Registro' },
  { to: '/reportes',   icon: 'analytics',         label: 'Reportes' },
]

function Icon({ name, filled = false }) {
  return (
    <span
      className="material-symbols-outlined"
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  )
}

export default function Layout() {
  const { currentUser, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex flex-col w-72 bg-surface-container-low border-r border-outline-variant/30 sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="p-8">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>
                inventory
              </span>
            </div>
            <div>
              <p className="font-headline italic text-xl font-bold text-primary tracking-widest uppercase leading-none">Stock</p>
              <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">Control de inventario</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-2">
            {navItems.map(({ to, icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center space-x-4 px-5 py-3 rounded-xl transition-all font-label text-sm font-bold uppercase tracking-widest
                  ${isActive
                    ? 'bg-primary-container text-on-primary-container shadow-sm scale-[1.02]'
                    : 'text-on-surface-variant hover:bg-surface-variant/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon name={icon} filled={isActive} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer sidebar */}
        <div className="mt-auto p-8 border-t border-outline-variant/10">
          <div className="flex flex-col gap-3">
            <div className="flex items-center space-x-3 p-3 rounded-xl bg-surface-container-highest/40">
              <span className="material-symbols-outlined text-primary">account_circle</span>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-on-surface truncate">{currentUser?.email}</p>
                <p className="text-xs text-on-surface-variant">Inventario v1.0</p>
              </div>
            </div>
            <button 
              onClick={() => logout()}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-on-surface-variant hover:bg-error-container hover:text-error transition-colors text-xs font-bold uppercase tracking-widest"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-x-hidden pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-background/90 backdrop-blur-xl flex justify-around items-center px-4 pb-6 pt-3 shadow-[0_-4px_24px_rgba(42,27,10,0.08)] rounded-t-3xl border-t border-outline-variant/20">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-transform font-label text-[9px] uppercase tracking-widest font-bold
              ${isActive
                ? 'bg-primary-container text-on-primary-container scale-105 shadow-sm'
                : 'text-on-surface-variant opacity-70'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={icon} filled={isActive} />
                <span className="mt-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
        
        {/* Mobile Logout Button */}
        <button
          onClick={() => logout()}
          className="flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-transform font-label text-[9px] uppercase tracking-widest font-bold text-error opacity-80"
        >
          <Icon name="logout" filled={false} />
          <span className="mt-1">Salir</span>
        </button>
      </nav>
    </div>
  )
}
