import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc, query, collection, where, getDocs, onSnapshot } from 'firebase/firestore'
import { updatePassword } from 'firebase/auth'
import { db } from '../config/firebase'

const navItems = [
  { to: '/dashboard',  icon: 'dashboard',        label: 'Inicio' },
  { to: '/inventario', icon: 'inventory_2',       label: 'Inventario' },
  { to: '/pedidos',    icon: 'local_shipping',    label: 'Pedidos' },
  { to: '/reportes',   icon: 'analytics',         label: 'Reportes' },
  { type: 'action',    icon: 'person',            label: 'Perfil', action: 'openUserMenu' },
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

// ── Centro de Usuario (Perfil + Tutorial) ──
function UserCenterModal({ isOpen, onClose, onStartTour }) {
  const { currentUser, logout } = useAuth()
  const [activeTab, setActiveTab] = useState(0) // 0: Perfil, 1: Ayuda
  
  // State Perfil
  const [profileData, setProfileData] = useState({ nombre: '', username: '', telefono: '' })
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [originalUsername, setOriginalUsername] = useState('')

  useEffect(() => {
    if (!isOpen || !currentUser) return
    async function fetch() {
      const docSnap = await getDoc(doc(db, 'usuarios', currentUser.uid))
      if (docSnap.exists()) {
        const data = docSnap.data()
        setProfileData(data)
        setOriginalUsername(data.username || '')
      }
      setLoading(false)
    }
    fetch()
  }, [isOpen, currentUser])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      if (profileData.username && profileData.username !== originalUsername) {
        const q = query(collection(db, 'usuarios'), where('username', '==', profileData.username))
        const qSnap = await getDocs(q)
        if (!qSnap.empty) throw new Error('El nombre de usuario ya existe.')
      }
      if (passwordData.newPassword && passwordData.newPassword !== passwordData.confirmPassword) {
        throw new Error('Las contraseñas no coinciden')
      }
      await setDoc(doc(db, 'usuarios', currentUser.uid), { 
        ...profileData, 
        email: currentUser.email,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      if (passwordData.newPassword) await updatePassword(currentUser, passwordData.newPassword)
      setOriginalUsername(profileData.username)
      setMessage('✅ Perfil actualizado')
      setTimeout(() => setMessage(''), 3000)
    } catch (err) { setMessage('❌ ' + err.message) }
    setSaving(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-overlay overflow-y-auto backdrop-blur-md">
      <div className="modal-content w-full max-w-2xl rounded-[2.5rem] p-0 relative border border-outline-variant/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Tabs */}
        <div className="flex bg-surface-container-low border-b border-outline-variant/10 shrink-0">
          <button 
            onClick={() => setActiveTab(0)}
            className={`flex-1 py-5 font-label text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2
              ${activeTab === 0 ? 'text-primary bg-white' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
          >
            <Icon name="person" filled={activeTab === 0} />
            Mi Perfil
          </button>
          <button 
            onClick={() => setActiveTab(1)}
            className={`flex-1 py-5 font-label text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2
              ${activeTab === 1 ? 'text-primary bg-white' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
          >
            <Icon name="school" filled={activeTab === 1} />
            Ayuda y Guía
          </button>
          <button onClick={onClose} className="px-6 text-on-surface-variant hover:text-error transition-colors">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-10 bg-white">
          {activeTab === 0 ? (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="font-headline text-3xl italic text-secondary mb-1">Tu Cuenta</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-8">Administra tus accesos y datos personales</p>
              
              {loading ? <p className="text-center py-20 opacity-30 font-bold uppercase text-[10px] tracking-widest">Cargando datos...</p> : (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-secondary mb-2">Usuario Único (@)</label>
                      <input 
                        type="text" 
                        value={profileData.username || ''} 
                        onChange={e => setProfileData({...profileData, username: e.target.value.replace(/\s+/g, '').toLowerCase()})}
                        className="w-full bg-surface-container-highest/20 border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary font-bold"
                        placeholder="ej: leyn"
                        maxLength={12}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-secondary mb-2">Teléfono de Contacto</label>
                      <input 
                        type="tel" 
                        value={profileData.telefono || ''} 
                        onChange={e => setProfileData({...profileData, telefono: e.target.value})}
                        className="w-full bg-surface-container-highest/20 border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary"
                        placeholder="+56 9..."
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-outline-variant/10">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4">Seguridad</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                        type="password" 
                        placeholder="Nueva contraseña"
                        onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                        className="w-full bg-surface-container-highest/20 border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary"
                      />
                      <input 
                        type="password" 
                        placeholder="Confirmar nueva clave"
                        onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        className="w-full bg-surface-container-highest/20 border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {message && <p className="text-[10px] font-bold text-center uppercase tracking-widest py-2 bg-primary/5 rounded-lg">{message}</p>}

                  <div className="flex flex-col md:flex-row gap-4 pt-4">
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="flex-1 py-4 bg-primary text-on-primary rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform disabled:opacity-50"
                    >
                      {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => logout()}
                      className="md:w-auto px-8 py-4 border-2 border-error/20 text-error rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] hover:bg-error/5 transition-colors"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="font-headline text-3xl italic text-secondary mb-1">Manual de Usuario</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-8">Aprende a dominar tu herramienta</p>
              
              <div className="space-y-4">
                {[
                  { title: 'Inicio', icon: 'dashboard', text: 'Resumen de valor de inventario y alertas.' },
                  { title: 'Inventario', icon: 'inventory_2', text: 'Gestiona productos y usa el escáner.' },
                  { title: 'Pedidos', icon: 'local_shipping', text: 'Registra ventas y fechas de entrega.' },
                  { title: 'Reportes', icon: 'analytics', text: 'Mira tus ganancias y registra pérdidas.' }
                ].map((s) => (
                  <div key={s.title} className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/5 flex gap-4 items-center">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Icon name={s.icon} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-secondary leading-none mb-1">{s.title}</p>
                      <p className="text-[11px] opacity-60 leading-tight">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex flex-col items-center text-center gap-4">
                <div>
                  <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">¿Necesitas un paseo visual?</p>
                  <p className="text-[10px] opacity-60 italic">Inicia las nubecitas para ver los botones en acción.</p>
                </div>
                <button 
                  onClick={onStartTour}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-secondary text-white rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-secondary/20 hover:scale-[1.02] transition-all"
                >
                  <Icon name="auto_awesome" />
                  Empezar Gira Interactiva
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Guided Tour (Guía Viajera) ──
function GuidedTour({ active, onComplete }) {
  const [step, setStep] = useState(0)
  const [pos, setPos] = useState({ display: 'none' })
  const navigate = useNavigate()
  const location = useLocation()
  
  const steps = [
    { target: '.tour-inicio-header', text: '¡Bienvenido! Aquí verás un resumen rápido de tu negocio.', path: '/dashboard', align: 'bottom' },
    { target: '.tour-inicio-metricas', text: 'Tus métricas clave: Valor de inventario, Stock y Alertas.', path: '/dashboard', align: 'top' },
    { target: '.tour-inv-nuevo', text: 'Desde aquí puedes agregar nuevos productos escaneando el código de barra.', path: '/inventario', align: 'bottom' },
    { target: '.tour-pedidos-crear', text: 'Registra tus ventas aquí. Los productos se descontarán automáticamente del stock.', path: '/pedidos', align: 'bottom' },
    { target: '.tour-reportes-grafico', text: 'Analiza tu desempeño. Compara tus ganancias contra las pérdidas del periodo.', path: '/reportes', align: 'bottom' },
    { target: '.tour-reportes-mermas', text: '¿Algo se rompió o se perdió? Regístralo aquí como merma para mantener tu stock real.', path: '/reportes', align: 'top' },
    { target: '.tour-perfil', text: 'Haz clic aquí para editar tu perfil, teléfono o cambiar contraseña.', path: '/dashboard', align: 'top' },
  ]

  // Reiniciar cuando se activa
  useEffect(() => {
    if (active) setStep(0)
  }, [active])

  // Recalcular posición
  useEffect(() => {
    if (!active) return
    
    const currentStep = steps[step]
    
    if (location.pathname !== currentStep.path) {
      navigate(currentStep.path)
      setPos({ display: 'none' })
      return
    }

    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.target)
      if (el) {
        // Traer al centro para asegurar visibilidad
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        
        // Esperamos al scroll
        setTimeout(() => {
          const rect = el.getBoundingClientRect()
          let top = rect.bottom + 20
          let left = rect.left

          if (currentStep.align === 'top') {
            top = rect.top - 180
          }
          
          // ── Evitar Sidebar (300px min en Desktop) ──
          if (window.innerWidth >= 768 && left < 300) {
            left = 310
          }

          // ── Clampear Bordes ──
          const bW = 280 // Ancho bubble aprox
          const bH = 180 // Alto bubble aprox
          
          if (left + bW > window.innerWidth) left = window.innerWidth - (bW + 20)
          if (left < 10) left = 10
          if (top + bH > window.innerHeight) top = window.innerHeight - (bH + 20)
          if (top < 10) top = 10

          setPos({ 
            position: 'fixed',
            top: `${top}px`, 
            left: `${left}px`,
            display: 'block'
          })
        }, 500)
      } else {
        setPos({ display: 'none' })
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [active, step, location.pathname])

  if (!active) return null

  const currentStep = steps[step]
  const handleNext = () => (step < steps.length - 1) ? setStep(step + 1) : onComplete()

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      <div className="absolute inset-0 bg-black/5 pointer-events-auto" onClick={onComplete} />
      <div 
        className="tour-bubble pointer-events-auto shadow-2xl"
        style={{ 
          ...pos,
          zIndex: 1001 
        }}
      >
        <p className="text-secondary font-label text-[10px] font-bold uppercase tracking-widest mb-2">Paso {step + 1} de {steps.length}</p>
        <p className="text-on-surface text-sm leading-relaxed mb-4">{currentStep.text}</p>
        <div className="flex justify-between items-center">
          <button onClick={onComplete} className="text-[10px] font-bold uppercase tracking-widest text-outline hover:text-primary">Omitir</button>
          <button onClick={handleNext} className="bg-primary text-on-primary px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm">
            {step === steps.length - 1 ? '¡Entendido!' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Layout() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [dbUser, setDbUser] = useState(null)
  const location = useLocation()

  useEffect(() => {
    if (!currentUser) {
      setDbUser(null)
      return
    }
    const unsub = onSnapshot(doc(db, 'usuarios', currentUser.uid), (snapshot) => {
      if (snapshot.exists()) setDbUser(snapshot.data())
    })
    return () => unsub()
  }, [currentUser])

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTourV1')
    if (!hasSeenTour && location.pathname === '/dashboard') {
      setTimeout(() => setTourActive(true), 1500)
    }
  }, [location])

  const finishTour = () => {
    localStorage.setItem('hasSeenTourV1', 'true')
    setTourActive(false)
  }

  const handleStartTour = () => {
    setShowUserMenu(false)
    if (location.pathname !== '/dashboard') {
      navigate('/dashboard')
      setTimeout(() => setTourActive(true), 600)
    } else {
      setTourActive(true)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex flex-col w-72 bg-surface-container-low border-r border-outline-variant/30 sticky top-0 h-screen overflow-y-auto shrink-0">
        <div className="p-8 h-full flex flex-col">
          {/* Logo / Brand */}
          <div className="flex items-center space-x-3 mb-12">
            <div className="w-14 h-14 bg-white rounded-xl shadow-sm flex items-center justify-center p-1 shrink-0">
              <img src="/logo.jpeg" alt="Logo Leis" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <p className="italic text-3xl text-primary leading-none" style={{ fontFamily: "'Noto Serif', serif" }}>Leis</p>
              <p className="text-[9px] text-on-surface-variant font-label uppercase tracking-widest mt-1.5 leading-tight">Control de inventario</p>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-2">
            {navItems.map((item) => (
              item.type === 'action' ? (
                <button
                  key={item.label}
                  onClick={() => setShowUserMenu(true)}
                  className="w-full flex items-center space-x-4 px-5 py-3 rounded-xl transition-all font-label text-sm font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant/50 tour-perfil"
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
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
                      <Icon name={item.icon} filled={isActive} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              )
            ))}
          </nav>

          {/* Branding / Badge at bottom of sidebar */}
          <div className="mt-auto pt-8 opacity-40 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Leis Software v1.2</p>
            <p className="text-[9px] italic mt-1 font-headline text-secondary">Tu éxito es nuestro inventario</p>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-x-hidden pb-24 md:pb-0 relative">
        <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center md:pl-72 opacity-20">
          <img 
            src="/logo.jpeg" 
            alt="Watermark" 
            className="w-[85%] md:w-[50%] max-w-lg rounded-[3.5rem] shadow-sm mix-blend-darken"
          />
        </div>
        
        <div className="relative z-10 h-full">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-background/90 backdrop-blur-xl flex justify-around items-center px-4 pb-6 pt-3 shadow-[0_-4px_24px_rgba(42,27,10,0.08)] rounded-t-3xl border-t border-outline-variant/20">
        {navItems.map((item) => (
          item.type === 'action' ? (
            <button
              key={item.label}
              onClick={() => setShowUserMenu(true)}
              className="flex flex-col items-center justify-center px-3 py-2 rounded-xl transition-transform font-label text-[9px] uppercase tracking-widest font-bold text-on-surface-variant opacity-70"
            >
              <Icon name={item.icon} />
              <span className="mt-1">{item.label}</span>
            </button>
          ) : (
            <NavLink
              key={item.label}
              to={item.to}
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
                  <Icon name={item.icon} filled={isActive} />
                  <span className="mt-1">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        ))}
      </nav>

      {/* ── Modal & Tour ── */}
      <UserCenterModal 
        isOpen={showUserMenu} 
        onClose={() => setShowUserMenu(false)} 
        onStartTour={handleStartTour}
      />
      <GuidedTour active={tourActive} onComplete={finishTour} />
    </div>
  )
}
