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

function Icon({ name, filled = false, className = '' }) {
  return (
    <span
      className={`material-symbols-outlined transition-all duration-300 ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  )
}

// ── Centro de Usuario (Perfil + Tutorial) ──
function UserCenterModal({ isOpen, onClose, onStartTour, isDark, toggleTheme }) {
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-overlay bg-black/60 dark:bg-black/80 overflow-y-auto backdrop-blur-md">
      <div className="modal-content w-full max-w-2xl rounded-[2.5rem] p-0 relative shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Tabs Luxe */}
        <div className="flex bg-surface-container-low dark:bg-[#121212] border-b border-outline-variant/5 dark:border-white/5 shrink-0">
          <button 
            onClick={() => setActiveTab(0)}
            className={`flex-1 py-6 font-label text-[10px] font-bold uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 relative
              ${activeTab === 0 ? 'text-primary dark:text-[#e2bd6c] bg-white dark:bg-[#121212]' : 'text-on-surface-variant dark:text-gray-500 hover:bg-surface-variant/50 dark:hover:bg-white/5'}`}
          >
            <Icon name="person" filled={activeTab === 0} className={activeTab === 0 ? 'scale-110' : 'opacity-50'} />
            Mi Perfil
            {activeTab === 0 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary dark:bg-[#e2bd6c] animate-in slide-in-from-bottom-1" />}
          </button>
          <button 
            onClick={() => setActiveTab(1)}
            className={`flex-1 py-6 font-label text-[10px] font-bold uppercase tracking-[0.25em] transition-all flex items-center justify-center gap-3 relative
              ${activeTab === 1 ? 'text-primary dark:text-[#e2bd6c] bg-white dark:bg-[#121212]' : 'text-on-surface-variant dark:text-gray-500 hover:bg-surface-variant/50 dark:hover:bg-white/5'}`}
          >
            <Icon name="school" filled={activeTab === 1} className={activeTab === 1 ? 'scale-110' : 'opacity-50'} />
            Ayuda y Guía
            {activeTab === 1 && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary dark:bg-[#e2bd6c] animate-in slide-in-from-bottom-1" />}
          </button>
          <button onClick={onClose} className="px-6 text-on-surface-variant dark:text-gray-500 hover:text-error transition-colors">
            <Icon name="close" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-10 bg-white dark:bg-[#1e1e1e] luxe-scrollbar">
          {activeTab === 0 ? (
            <div className="animate-in fade-in slide-in-from-left-4 duration-300">
              <h3 className="font-headline text-3xl italic text-secondary dark:text-[#e2bd6c] mb-1">Tu Cuenta</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-8">Administra tus accesos y datos personales</p>
              
              {loading ? <p className="text-center py-20 opacity-30 font-bold uppercase text-[10px] tracking-widest">Cargando datos...</p> : (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c] mb-2">Usuario Único (@)</label>
                      <input 
                        type="text" 
                        value={profileData.username || ''} 
                        onChange={e => setProfileData({...profileData, username: e.target.value.replace(/\s+/g, '').toLowerCase()})}
                        className="w-full bg-surface-container-highest/20 dark:bg-[#121212] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold dark:text-white transition-colors"
                        placeholder="ej: leyn"
                        maxLength={12}
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c] mb-2">Teléfono de Contacto</label>
                      <input 
                        type="tel" 
                        value={profileData.telefono || ''} 
                        onChange={e => setProfileData({...profileData, telefono: e.target.value})}
                        className="w-full bg-surface-container-highest/20 dark:bg-[#121212] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white transition-colors"
                        placeholder="+56 9..."
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-outline-variant/10 dark:border-white/10">
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 dark:text-[#e2bd6c]/60 mb-5">Preferencias de Interfaz</h4>
                    <button 
                      type="button"
                      onClick={toggleTheme}
                      className="w-full flex items-center justify-between p-6 rounded-[2rem] bg-gradient-to-br from-surface-container-low to-surface-container-high dark:from-[#1a1a1a] dark:to-[#121212] border border-outline-variant/20 dark:border-white/5 hover:border-primary/30 dark:hover:border-[#e2bd6c]/30 transition-all duration-500 group relative overflow-hidden shadow-sm hover:shadow-xl dark:shadow-none"
                    >
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/0 via-primary/5 dark:via-[#e2bd6c]/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl" />
                      
                      <div className="flex items-center gap-5 relative z-10">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c] rotate-[15deg]' : 'bg-primary/10 text-primary rotate-0'}`}>
                          <Icon name={isDark ? 'dark_mode' : 'light_mode'} filled={true} className="text-2xl" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-headline font-bold text-on-surface dark:text-white leading-none mb-1.5 italic">
                            Apariencia {isDark ? 'Luxe Dark' : 'Modern Light'}
                          </p>
                          <p className="text-[9px] text-outline dark:text-gray-500 font-bold uppercase tracking-widest">Toque para alternar el ambiente</p>
                        </div>
                      </div>

                      <div className={`w-16 h-8 rounded-full relative transition-all duration-500 border shadow-inner ${isDark ? 'bg-[#e2bd6c] border-[#f3d692]' : 'bg-outline-variant/30 border-outline-variant/10'}`}>
                        {isDark && <div className="absolute inset-0 bg-[#e2bd6c] blur-md opacity-40 animate-pulse" />}
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-2xl flex items-center justify-center ${isDark ? 'left-9' : 'left-1'}`}>
                           <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[#e2bd6c]' : 'bg-primary/20'}`} />
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="pt-6 border-t border-outline-variant/10 dark:border-white/10">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary dark:text-[#e2bd6c] mb-4">Seguridad</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                        type="password" 
                        placeholder="Nueva contraseña"
                        onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                        className="w-full bg-surface-container-highest/20 dark:bg-[#121212] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white transition-colors"
                      />
                      <input 
                        type="password" 
                        placeholder="Confirmar nueva clave"
                        onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        className="w-full bg-surface-container-highest/20 dark:bg-[#121212] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white transition-colors"
                      />
                    </div>
                  </div>

                  {message && (
                    <p className={`text-[10px] font-bold text-center uppercase tracking-widest py-3 rounded-xl animate-in fade-in zoom-in-95 duration-200
                      ${message.includes('❌') ? 'bg-error/10 text-error' : 'bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c]'}`}>
                      {message}
                    </p>
                  )}

                  <div className="flex flex-col md:flex-row gap-4 pt-6">
                    <button 
                      type="submit" 
                      disabled={saving}
                      className="flex-1 py-4 bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black rounded-2xl font-bold uppercase text-[10px] tracking-[0.3em] shadow-lg shadow-primary/20 dark:shadow-[#e2bd6c]/10 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {saving ? 'Procesando...' : 'Guardar Perfil'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => logout()}
                      className="md:w-auto px-8 py-4 border-2 border-error/20 text-error rounded-2xl font-bold uppercase text-[10px] tracking-[0.3em] hover:bg-error/5 transition-all active:scale-[0.98]"
                    >
                      Salir
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="font-headline text-3xl italic text-secondary dark:text-[#e2bd6c] mb-1">Manual de Usuario</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-8">Aprende a dominar tu herramienta</p>
              
              <div className="space-y-4">
                {[
                  { title: 'Inicio', icon: 'dashboard', text: 'Resumen de valor de inventario y alertas.' },
                  { title: 'Inventario', icon: 'inventory_2', text: 'Gestiona productos y usa el escáner.' },
                  { title: 'Pedidos', icon: 'local_shipping', text: 'Registra ventas y fechas de entrega.' },
                  { title: 'Reportes', icon: 'analytics', text: 'Mira tus ganancias y registra pérdidas.' }
                ].map((s) => (
                  <div key={s.title} className="p-4 rounded-2xl bg-surface-container-low dark:bg-[#121212] border border-outline-variant/5 dark:border-white/5 flex gap-4 items-center">
                    <div className="p-2 rounded-xl bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c]">
                      <Icon name={s.icon} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-secondary dark:text-[#e2bd6c] leading-none mb-1">{s.title}</p>
                      <p className="text-[11px] opacity-60 dark:text-white/60 leading-tight">{s.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 p-6 bg-secondary/5 dark:bg-[#e2bd6c]/5 rounded-3xl border border-secondary/10 dark:border-[#e2bd6c]/10 flex flex-col items-center text-center gap-4">
                <div>
                  <p className="text-xs font-bold text-secondary dark:text-[#e2bd6c] uppercase tracking-widest mb-1">¿Necesitas un paseo visual?</p>
                  <p className="text-[10px] opacity-60 dark:text-white/40 italic">Inicia las nubecitas para ver los botones en acción.</p>
                </div>
                <button 
                  onClick={onStartTour}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-secondary dark:bg-[#e2bd6c] text-white dark:text-black rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-secondary/20 dark:shadow-[#e2bd6c]/10 hover:scale-[1.02] transition-all"
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
        className="tour-bubble pointer-events-auto shadow-2xl bg-white dark:bg-[#1e1e1e] border border-outline-variant/10 dark:border-white/10"
        style={{ 
          ...pos,
          zIndex: 1001 
        }}
      >
        <p className="text-secondary dark:text-[#e2bd6c] font-label text-[10px] font-bold uppercase tracking-widest mb-2">Paso {step + 1} de {steps.length}</p>
        <p className="text-on-surface dark:text-white/90 text-sm leading-relaxed mb-4">{currentStep.text}</p>
        <div className="flex justify-between items-center">
          <button onClick={onComplete} className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 hover:text-primary dark:hover:text-[#e2bd6c]">Omitir</button>
          <button onClick={handleNext} className="bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm">
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

  // ── Lógica de Modo Oscuro Nativo ──
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => setIsDark(!isDark)

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
    <div className="flex min-h-screen bg-background dark:bg-[#121212] transition-colors duration-500">

      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex flex-col w-72 bg-surface-container-low dark:bg-[#181818] border-r border-outline-variant/30 dark:border-white/5 sticky top-0 h-screen overflow-y-auto shrink-0 transition-all duration-500 [.modal-open_&]:hidden">
        <div className="p-8 h-full flex flex-col">
          {/* Logo / Brand + Theme Toggle */}
          <div className="flex justify-between items-start mb-12">
            <Link to="/dashboard" className="flex items-center space-x-4 hover:opacity-80 transition-opacity cursor-pointer group">
              <div className="w-16 h-16 bg-surface-container-highest/50 dark:bg-white/5 rounded-2xl shadow-sm flex items-center justify-center p-1.5 shrink-0 crystal-effect border border-outline-variant/10 dark:border-white/10">
                <img src="/logo.jpeg" alt="Logo Leis" className="w-full h-full object-contain rounded-xl dark:opacity-80" />
              </div>
              <div>
                <p className="italic text-3xl text-primary dark:text-[#e2bd6c] leading-none" style={{ fontFamily: "'Noto Serif', serif" }}>Leis</p>
                <p className="text-[9px] text-on-surface-variant dark:text-gray-500 font-label uppercase tracking-widest mt-1 leading-tight group-hover:text-primary transition-colors">Software</p>
              </div>
            </Link>

            <button 
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-surface-container-high/50 dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 flex items-center justify-center text-primary dark:text-[#e2bd6c] hover:bg-primary/10 transition-all active:scale-95"
            >
              <Icon name={isDark ? 'light_mode' : 'dark_mode'} className="text-xl" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="space-y-2">
            {navItems.map((item) => (
              item.type === 'action' ? (
                <button
                  key={item.label}
                  onClick={() => setShowUserMenu(true)}
                  className="w-full flex items-center space-x-4 px-5 py-3 rounded-xl transition-all font-label text-sm font-bold uppercase tracking-widest text-on-surface-variant dark:text-gray-400 hover:bg-surface-variant/50 tour-perfil group"
                >
                  <Icon name={item.icon} className="group-hover:scale-[1.2] group-hover:-rotate-12 group-hover:text-primary origin-center" />
                  <span>{item.label}</span>
                </button>
              ) : item.type === 'link' ? (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center space-x-4 px-5 py-3 rounded-xl transition-all font-label text-sm font-bold uppercase tracking-widest text-on-surface-variant dark:text-gray-400 hover:bg-surface-variant/50 dark:hover:bg-white/5 group"
                >
                  <Icon name={item.icon} className="group-hover:scale-[1.2] group-hover:-rotate-12 group-hover:text-primary dark:group-hover:text-[#e2bd6c] origin-center" />
                  <span>{item.label}</span>
                </a>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-4 px-5 py-3 rounded-xl transition-all duration-300 font-label text-sm font-bold uppercase tracking-widest group
                    ${isActive
                      ? 'bg-primary/10 text-primary dark:bg-[#e2bd6c]/10 dark:text-[#e2bd6c] shadow-sm scale-[1.02]'
                      : 'text-on-surface-variant dark:text-gray-400 hover:bg-surface-variant/50 dark:hover:bg-white/5'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon name={item.icon} filled={isActive} className={`${isActive ? 'scale-110 text-primary dark:text-[#e2bd6c]' : ''} group-hover:scale-[1.2] group-hover:-rotate-12 group-hover:text-primary dark:group-hover:text-[#e2bd6c] origin-center`} />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              )
            ))}
          </nav>

          {/* Branding / Badge at bottom of sidebar */}
          <div className="mt-auto pt-8 opacity-40 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-[#e2bd6c]">Leis Administration V1.2</p>
            <p className="text-[10px] italic mt-1 font-headline text-secondary dark:text-[#e2bd6c]/80">Tu exito esta en nuestros productos</p>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-x-hidden pb-24 md:pb-0 relative">
        <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center md:pl-72 opacity-10 dark:opacity-20">
          <img 
            src="/logo.jpeg" 
            alt="Watermark" 
            className="w-3/4 md:w-2/5 max-w-lg rounded-[3.5rem] grayscale dark:invert brightness-125 dark:brightness-100 mix-blend-multiply dark:mix-blend-overlay"
          />
        </div>
        
        <div className="relative z-10 h-full">
          <Outlet context={{ isDark }} />
        </div>
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-background/95 dark:bg-[#121212]/95 backdrop-blur-2xl flex justify-around items-center px-4 pb-8 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.5)] rounded-t-[2.5rem] border-t border-outline-variant/10 dark:border-white/5 transition-transform duration-300 [.modal-open_&]:translate-y-full">
        {navItems.map((item) => (
          item.type === 'action' ? (
            <button
              key={item.label}
              onClick={() => setShowUserMenu(true)}
              className="flex flex-col items-center justify-center px-3 py-2 rounded-2xl transition-all font-label text-[8px] uppercase tracking-[0.2em] font-extrabold text-on-surface-variant dark:text-gray-500 opacity-80 group active:scale-90"
            >
              <Icon name={item.icon} className="group-active:text-primary dark:group-active:text-[#e2bd6c] transition-colors" />
              <span className="mt-1">{item.label}</span>
            </button>
          ) : item.type === 'link' ? (
            <a
              key={item.label}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center px-3 py-2 rounded-2xl transition-all font-label text-[8px] uppercase tracking-[0.2em] font-extrabold text-on-surface-variant dark:text-gray-500 opacity-80 group active:scale-90"
            >
              <Icon name={item.icon} className="group-active:text-primary dark:group-active:text-[#e2bd6c] transition-colors" />
              <span className="mt-1">{item.label}</span>
            </a>
          ) : (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-300 font-label text-[8px] uppercase tracking-[0.2em] font-extrabold group
                ${isActive
                  ? 'bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] scale-110'
                  : 'text-on-surface-variant dark:text-gray-500 opacity-60'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} filled={isActive} className={`${isActive ? 'scale-110' : ''} group-active:scale-125 transition-all`} />
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
        isDark={isDark}
        toggleTheme={toggleTheme}
      />
      <GuidedTour active={tourActive} onComplete={finishTour} />
    </div>
  )
}
