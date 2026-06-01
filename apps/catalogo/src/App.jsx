import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, setDoc, getDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db, auth } from './config/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, deleteUser, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth'

// Número de WhatsApp al que llegarán los pedidos (formato internacional sin el +)
const WHATSAPP_NUMBER = "56921648127" // ¡Cambia esto por tu número real!

function mergeCarts(localCart, dbCart) {
  const merged = [...(dbCart || [])]
  if (localCart && localCart.length > 0) {
    localCart.forEach(localItem => {
      const existingIdx = merged.findIndex(dbItem => dbItem.idCart === localItem.idCart)
      if (existingIdx > -1) {
        const combinedQty = merged[existingIdx].cantidad + localItem.cantidad
        merged[existingIdx].cantidad = Math.min(combinedQty, merged[existingIdx].maxStock)
      } else {
        merged.push(localItem)
      }
    })
  }
  return merged
}

const PulsingRing = ({ className, style }) => (
  <div className={`absolute pointer-events-none z-40 flex items-center justify-center ${className || ''}`} style={style}>
    <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-current shadow-lg border border-white" />
  </div>
);

const GlowingHighlight = ({ className, style }) => (
  <div className={`absolute pointer-events-none z-30 rounded-lg bg-current/10 border-2 border-current/40 animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.5)] ${className || ''}`} style={style} />
);

const FloatingArrow = ({ className, style, direction = 'down' }) => {
  const iconMap = {
    down: 'arrow_downward',
    left: 'arrow_back',
    right: 'arrow_forward',
    up: 'arrow_upward',
    diagonal: 'south_west'
  };
  return (
    <div className={`absolute pointer-events-none z-50 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] animate-bounce ${className || ''}`} style={style}>
      <span className="material-symbols-outlined text-2xl font-black text-[#e2bd6c]">
        {iconMap[direction]}
      </span>
    </div>
  );
};

const getCategoriaIcon = (catName) => {
  const name = catName.toUpperCase().trim();
  if (name === 'TODAS') return 'grid_view';
  if (name.includes('ANILLO')) return 'panorama_fish_eye';
  if (name.includes('ANTIFAZ')) return 'theater_comedy';
  if (name.includes('ARO')) return 'trip_origin';
  if (name.includes('CEJA')) return 'face';
  if (name.includes('COLLAR')) return 'diamond';
  if (name.includes('CONJUNTO')) return 'auto_awesome_motion';
  if (name.includes('CORPORAL')) return 'accessibility_new';
  if (name.includes('CUIDADO') || name.includes('CAPILAR') || name.includes('CABELLO')) return 'spa';
  if (name.includes('LABIAL') || name.includes('LABIOS')) return 'volunteer_activism';
  if (name.includes('MAQUILLAJE') || name.includes('FACIAL')) return 'brush';
  if (name.includes('CREMA') || name.includes('PIEL')) return 'water_drop';
  if (name.includes('PERFUME') || name.includes('AROMA')) return 'air';
  return 'star_rate';
}

export default function CatalogoPublico() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

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
  
  // Filtros Avanzados
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const categoryContainerRef = useRef(null)

  // Carrito: array de { idCart, producto, variante, cantidad, precio, maxStock }
  const [carrito, setCarrito] = useState(() => {
    try {
      const guardado = localStorage.getItem('carritoLeis')
      return guardado ? JSON.parse(guardado) : []
    } catch (e) {
      return []
    }
  })

  const [isCartOpen, setIsCartOpen] = useState(false)
  const [filtroCartCategory, setFiltroCartCategory] = useState('TODOS')

  // Estado del Tutorial de Compra interactivo
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('hide_catalogo_tutorial') !== 'true';
  })

  // Paso actual del Viaje de Compra guiado (0 = inactivo, 1 a 7 = pasos)
  const [tourStep, setTourStep] = useState(0)
  const [isDialogMinimized, setIsDialogMinimized] = useState(false)

  // Estados para colapsar barra lateral y secciones
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isBusquedaExpanded, setIsBusquedaExpanded] = useState(true)
  const [isPrecioExpanded, setIsPrecioExpanded] = useState(true)
  const [isDisponibilidadExpanded, setIsDisponibilidadExpanded] = useState(true)
  const [isCategoriasExpanded, setIsCategoriasExpanded] = useState(true)
  
  // Estado para el modal del video tutorial e interfaz interactiva simulada
  const [showVideoModal, setShowVideoModal] = useState(false)
  const [videoIsPlaying, setVideoIsPlaying] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoIsMuted, setVideoIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoDuration = 25 // 25 segundos (5s por diapositiva)
  const audioRef = useRef(null)
  const simulatorRef = useRef(null)

  const toggleFullscreen = () => {
    if (!simulatorRef.current) return;
    
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
      const req = simulatorRef.current.requestFullscreen || 
                  simulatorRef.current.webkitRequestFullscreen || 
                  simulatorRef.current.mozRequestFullScreen || 
                  simulatorRef.current.msRequestFullscreen;
      if (req) {
        req.call(simulatorRef.current).catch(err => {
          console.error("Error entering fullscreen:", err);
        });
      }
    } else {
      const exit = document.exitFullscreen || 
                   document.webkitExitFullscreen || 
                   document.mozCancelFullScreen || 
                   document.msExitFullscreen;
      if (exit) {
        exit.call(document);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFull = !!(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement || 
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    let interval = null;
    if (showVideoModal && videoIsPlaying) {
      interval = setInterval(() => {
        setVideoCurrentTime((prevTime) => {
          if (prevTime >= videoDuration) {
            return 0; // Bucle continuo
          }
          return Number((prevTime + 0.1).toFixed(1));
        });
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [showVideoModal, videoIsPlaying]);

  // Controlar la reproducción de la música de fondo MP3 real
  useEffect(() => {
    if (audioRef.current) {
      if (showVideoModal && videoIsPlaying) {
        audioRef.current.play().catch((err) => {
          console.log("El navegador bloqueó la reproducción automática. Se activará tras interactuar.", err);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [showVideoModal, videoIsPlaying]);

  // Controlar el volumen y el silenciado de la música
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = videoIsMuted;
      audioRef.current.volume = videoIsMuted ? 0 : 0.35; // Un volumen suave de fondo del 35%
    }
  }, [videoIsMuted]);

  // Resetear audio al cerrar el modal
  useEffect(() => {
    if (!showVideoModal && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [showVideoModal]);

  const activeSlide = Math.min(4, Math.floor(videoCurrentTime / 5));

  // ── MATH INTERPOLATION FOR SIMULATED VIDEO SCREENCAST ──
  const interpolate = (t, tStart, tEnd, valStart, valEnd) => {
    if (t <= tStart) return valStart;
    if (t >= tEnd) return valEnd;
    const pct = (t - tStart) / (tEnd - tStart);
    const ease = pct * pct * (3 - 2 * pct); // Ease-in-out curve
    return valStart + (valEnd - valStart) * ease;
  };

  const camera = (() => {
    let scale = 1.0;
    let xShift = 0;
    let yShift = 0;
    const t = videoCurrentTime;

    if (t < 5) {
      // Intro slide: scale slowly from 1.0 to 1.05
      scale = interpolate(t, 0, 5, 1.0, 1.05);
      xShift = 0;
      yShift = 0;
    } else if (t >= 5 && t < 10) {
      // Slide 1: Explorar filtros & Búsqueda (5.0s to 10.0s)
      const st = t - 5;
      if (st < 1.5) {
        // Zooming in on search input (around x=9.0%, y=19.5%)
        scale = interpolate(st, 0, 1.5, 1.05, 1.45);
        xShift = interpolate(st, 0, 1.5, 0, 28); // translate right to center the left sidebar
        yShift = interpolate(st, 0, 1.5, 0, 15); // translate down to center the search bar
      } else if (st >= 1.5 && st < 3.0) {
        // Stay on search input typing
        scale = 1.45;
        xShift = 28;
        yShift = 15;
      } else if (st >= 3.0 && st < 4.5) {
        // Smoothly panning to the top-right "Aro Verde Mini" card (around x=88%, y=35%)
        scale = interpolate(st, 3.0, 4.5, 1.45, 1.35);
        xShift = interpolate(st, 3.0, 4.5, 28, -32); // translate left to center the top-right card
        yShift = interpolate(st, 3.0, 4.5, 15, 10);  // translate up to center the top-right card
      } else {
        // Stay on card click
        scale = 1.35;
        xShift = -32;
        yShift = 10;
      }
    } else if (t >= 10 && t < 15) {
      // Slide 2: Agregar al carrito (10.0s to 15.0s)
      const st = t - 10;
      if (st < 1.5) {
        // Zoom in on product details image (around x=30%, y=50%)
        scale = interpolate(st, 0, 1.5, 1.0, 1.3);
        xShift = interpolate(st, 0, 1.5, 0, 18);
        yShift = interpolate(st, 0, 1.5, 0, 0);
      } else if (st >= 1.5 && st < 3.0) {
        // Smooth pan to "AÑADIR AL PEDIDO" button (around x=86%, y=90%)
        scale = interpolate(st, 1.5, 3.0, 1.3, 1.4);
        xShift = interpolate(st, 1.5, 3.0, 18, -32);
        yShift = interpolate(st, 1.5, 3.0, 0, -32);
      } else if (st >= 3.0 && st < 4.8) {
        // Pan up/right to header cart badge (around x=96.5%, y=6.0%)
        scale = interpolate(st, 3.0, 4.8, 1.4, 1.25);
        xShift = interpolate(st, 3.0, 4.8, -32, -38);
        yShift = interpolate(st, 3.0, 4.8, -32, 36);
      } else {
        scale = 1.25;
        xShift = -38;
        yShift = 36;
      }
    } else if (t >= 15 && t < 20) {
      // Slide 3: Abrir carrito drawer (15.0s to 20.0s)
      const st = t - 15;
      if (st < 1.2) {
        scale = 1.25;
        xShift = -38;
        yShift = 36;
      } else if (st >= 1.2 && st < 3.0) {
        // Pan to drawer "Hacer Pedido" button (around x=85.5%, y=94.5%)
        scale = interpolate(st, 1.2, 3.0, 1.25, 1.45);
        xShift = interpolate(st, 1.2, 3.0, -38, -32);
        yShift = interpolate(st, 1.2, 3.0, 36, -38);
      } else {
        scale = 1.45;
        xShift = -32;
        yShift = -38;
      }
    } else if (t >= 20) {
      // Slide 4: Confirmar y enviar WhatsApp (20.0s to 25.0s)
      const st = t - 20;
      if (st < 1.2) {
        // Focus modal Name Input (around x=52%, y=68%)
        scale = interpolate(st, 0, 1.2, 1.0, 1.45);
        xShift = interpolate(st, 0, 1.2, 0, 0);
        yShift = interpolate(st, 0, 1.2, 0, -14);
      } else if (st >= 1.2 && st < 3.5) {
        // Typing name
        scale = 1.45;
        xShift = 0;
        yShift = -14;
      } else if (st >= 3.5 && st < 4.5) {
        // Pan to "Enviar a WhatsApp" green button (around x=64.5%, y=85.5%)
        scale = interpolate(st, 3.5, 4.5, 1.45, 1.35);
        xShift = interpolate(st, 3.5, 4.5, 0, -12);
        yShift = interpolate(st, 3.5, 4.5, -14, -28);
      } else {
        scale = 1.35;
        xShift = -12;
        yShift = -28;
      }
    }

    return { scale, xShift, yShift };
  })();

  const getSimulatedCursor = (t) => {
    let x = 50;
    let y = 50;
    let opacity = 0;
    let isClicking = false;

    if (t < 5) {
      // Intro slide: cursor hidden
      return { x: 50, y: 50, opacity: 0, isClicking: false };
    } else if (t >= 5 && t < 10) {
      // Slide 1: Explorar filtros & Búsqueda (5.0s to 10.0s)
      const st = t - 5;
      opacity = 1;
      if (st < 1.5) {
        // Move from center (50, 50) to Search input (9.0%, 19.5%)
        x = interpolate(st, 0, 1.5, 50, 9.0);
        y = interpolate(st, 0, 1.5, 50, 19.5);
      } else if (st >= 1.5 && st < 3.0) {
        // Stay on search input typing
        x = 9.0;
        y = 19.5;
      } else if (st >= 3.0 && st < 4.2) {
        // Move from search input (9.0, 19.5) to "Aro Verde Mini" card (88.0%, 35.0%)
        x = interpolate(st, 3.0, 4.2, 9.0, 88.0);
        y = interpolate(st, 3.0, 4.2, 19.5, 35.0);
      } else {
        // Stay and click the card
        x = 88.0;
        y = 35.0;
        if (st >= 4.2 && st < 4.5) {
          isClicking = true;
        }
      }
    } else if (t >= 10 && t < 15) {
      // Slide 2: Agregar al carrito (10.0s to 15.0s)
      const st = t - 10;
      opacity = 1;
      if (st < 1.5) {
        // Move from last position (88.0, 35.0) to "AÑADIR AL PEDIDO" button (86.0%, 90.0%)
        x = interpolate(st, 0, 1.5, 88.0, 86.0);
        y = interpolate(st, 0, 1.5, 35.0, 90.0);
      } else if (st >= 1.5 && st < 2.5) {
        // Stay and click add to cart button
        x = 86.0;
        y = 90.0;
        if (st >= 1.5 && st < 1.8) {
          isClicking = true;
        }
      } else {
        // Move cursor to header cart (96.5%, 6.0%)
        x = interpolate(st, 2.5, 4.8, 86.0, 96.5);
        y = interpolate(st, 2.5, 4.8, 90.0, 6.0);
      }
    } else if (t >= 15 && t < 20) {
      // Slide 3: Abrir carrito drawer (15.0s to 20.0s)
      const st = t - 15;
      opacity = 1;
      if (st < 1.2) {
        // Hold and click header cart icon at t=16.2s
        x = 96.5;
        y = 6.0;
        if (st >= 0.8 && st < 1.1) {
          isClicking = true;
        }
      } else if (st >= 1.2 && st < 3.0) {
        // Move down to drawer "Hacer Pedido" yellow button (85.5%, 94.5%)
        x = interpolate(st, 1.2, 3.0, 96.5, 85.5);
        y = interpolate(st, 1.2, 3.0, 6.0, 94.5);
      } else {
        // Click drawer "Hacer Pedido" button at t=18.0s
        x = 85.5;
        y = 94.5;
        if (st >= 3.0 && st < 3.3) {
          isClicking = true;
        }
      }
    } else if (t >= 20 && t <= 25) {
      // Slide 4: Confirmar y enviar WhatsApp (20.0s to 25.0s)
      const st = t - 20;
      opacity = t >= 24.8 ? 0 : 1;
      if (st < 1.2) {
        // Move from drawer button (85.5, 94.5) to modal Name Input (52.0%, 68.0%)
        x = interpolate(st, 0, 1.2, 85.5, 52.0);
        y = interpolate(st, 0, 1.2, 94.5, 68.0);
      } else if (st >= 1.2 && st < 3.5) {
        // Typing on Name Input
        x = 52.0;
        y = 68.0;
      } else if (st >= 3.5 && st < 4.5) {
        // Move from Name Input (52.0, 68.0) to "Enviar a WhatsApp" green button (64.5%, 85.5%)
        x = interpolate(st, 3.5, 4.5, 52.0, 64.5);
        y = interpolate(st, 3.5, 4.5, 68.0, 85.5);
      } else {
        // Click green button at t=24.5s
        x = 64.5;
        y = 85.5;
        if (st >= 4.5 && st < 4.8) {
          isClicking = true;
        }
      }
    }
    return { x, y, opacity, isClicking };
  };

  const cursor = getSimulatedCursor(videoCurrentTime);

  // Compute typing values pure-functionally
  let simulatedSearchVal = "";
  let simulatedNameVal = "";
  let isCategoryClicked = false;
  let simulatedCartCountVal = 0;
  let simulatedSuccessOpen = false;
  let showFlyingDot = false;
  let dotX = 86.0;
  let dotY = 90.0;

  if (videoCurrentTime >= 5 && videoCurrentTime < 10) {
    const st = videoCurrentTime - 5;
    if (st >= 1.5 && st < 3.0) {
      const text = "Aro";
      const chars = Math.min(text.length, Math.floor((st - 1.5) / 0.4));
      simulatedSearchVal = text.substring(0, chars);
    } else if (st >= 3.0) {
      simulatedSearchVal = "Aro";
    }
  } else if (videoCurrentTime >= 10 && videoCurrentTime < 15) {
    const st = videoCurrentTime - 10;
    simulatedSearchVal = "Aro";
    if (st >= 1.5 && st < 2.8) {
      showFlyingDot = true;
      const pct = (st - 1.5) / 1.3;
      const easePct = pct * pct * (3 - 2 * pct);
      dotX = 86.0 + (96.5 - 86.0) * easePct;
      dotY = 90.0 + (6.0 - 90.0) * easePct;
    }
    simulatedCartCountVal = (st >= 2.8) ? 1 : 0;
  } else if (videoCurrentTime >= 15 && videoCurrentTime < 20) {
    simulatedCartCountVal = 1;
    simulatedSearchVal = "Aro";
  } else if (videoCurrentTime >= 20) {
    simulatedCartCountVal = 1;
    simulatedSearchVal = "Aro";
    const st = videoCurrentTime - 20;
    if (st >= 1.2 && st < 3.5) {
      const text = "Yamir Leis";
      const chars = Math.min(text.length, Math.floor((st - 1.2) / 0.23));
      simulatedNameVal = text.substring(0, chars);
    } else if (st >= 3.5) {
      simulatedNameVal = "Yamir Leis";
    }
    if (st >= 4.5) {
      simulatedSuccessOpen = true;
    }
  }

  const formatVideoTime = (seconds) => {
    const secs = Math.floor(seconds);
    return `0:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Auto-restaurar globo al cambiar de paso
  useEffect(() => {
    if (tourStep > 0) {
      setIsDialogMinimized(false)
    }
  }, [tourStep])

  // Avanzar del paso 4 al 5 cuando el usuario abre el carrito
  useEffect(() => {
    if (tourStep === 4 && isCartOpen) {
      setTourStep(5)
    }
  }, [isCartOpen, tourStep])

  // Modal de selección de variantes
  const [productParaAñadir, setProductParaAñadir] = useState(null)
  const [varianteSeleccionada, setVarianteSeleccionada] = useState('')

  // Modal de detalle del producto
  const [productoParaVer, setProductoParaVer] = useState(null)
  
  // Modal checkout final
  const [showCheckout, setShowCheckout] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')

  // Auth State
  const [currentUser, setCurrentUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authTab, setAuthTab] = useState('login') // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ nombre: '', email: '', password: '', whatsapp: '' })
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Edit Profile States
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editProfileForm, setEditProfileForm] = useState({ nombre: '', whatsapp: '' })
  const [editProfileError, setEditProfileError] = useState('')
  const [editProfileSuccess, setEditProfileSuccess] = useState('')
  const [isEditProfileLoading, setIsEditProfileLoading] = useState(false)

  // Delete Account States
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteAccountError, setDeleteAccountError] = useState('')
  const [deleteAccountSuccess, setDeleteAccountSuccess] = useState('')
  const [isDeleteAccountLoading, setIsDeleteAccountLoading] = useState(false)

  // Password Recovery States
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false)
  const [resetEmailSuccess, setResetEmailSuccess] = useState('')
  const [resetEmailError, setResetEmailError] = useState('')
  const [isResetEmailLoading, setIsResetEmailLoading] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')

  // Referencias para evitar condiciones de carrera en la sincronización del carrito
  const loadingCartFromDb = useRef(false)
  const lastLoadedUid = useRef(null)
  const isRegistering = useRef(false)
  const mainScrollRef = useRef(null)

  const [animacion, setAnimacion] = useState('') // '', 'salir-izquierda', 'salir-derecha', etc.
  const [indexImagenActual, setIndexImagenActual] = useState(0)
  const [mostrarIndicador, setMostrarIndicador] = useState(false)
  const [mostrarControlesZoom, setMostrarControlesZoom] = useState(true)
  const [expandedImage, setExpandedImage] = useState(null)

  // --- Back button closing for mobile/browser history ---
  useEffect(() => {
    const handlePopState = (event) => {
      if (
        isCartOpen ||
        productParaAñadir ||
        productoParaVer ||
        showCheckout ||
        showAuthModal ||
        showEditProfileModal ||
        showDeleteAccountModal ||
        showResetPasswordModal ||
        expandedImage
      ) {
        setIsCartOpen(false);
        setProductParaAñadir(null);
        setProductoParaVer(null);
        setShowCheckout(false);
        setShowAuthModal(false);
        setShowEditProfileModal(false);
        setShowDeleteAccountModal(false);
        setShowResetPasswordModal(false);
        setExpandedImage(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isCartOpen,
    productParaAñadir,
    productoParaVer,
    showCheckout,
    showAuthModal,
    showEditProfileModal,
    showDeleteAccountModal,
    showResetPasswordModal,
    expandedImage
  ]);

  const wasModalOpenRef = useRef(false);

  useEffect(() => {
    const anyOpen = !!(
      isCartOpen ||
      productParaAñadir ||
      productoParaVer ||
      showCheckout ||
      showAuthModal ||
      showEditProfileModal ||
      showDeleteAccountModal ||
      showResetPasswordModal ||
      expandedImage
    );

    if (anyOpen && !wasModalOpenRef.current) {
      window.history.pushState({ modalOpen: true }, '');
      wasModalOpenRef.current = true;
    } else if (!anyOpen && wasModalOpenRef.current) {
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
      wasModalOpenRef.current = false;
    }
  }, [
    isCartOpen,
    productParaAñadir,
    productoParaVer,
    showCheckout,
    showAuthModal,
    showEditProfileModal,
    showDeleteAccountModal,
    showResetPasswordModal,
    expandedImage
  ]);

  // Sincronización dual del carrito: localStorage + Firestore
  useEffect(() => {
    localStorage.setItem('carritoLeis', JSON.stringify(carrito))
    
    if (currentUser && !loadingCartFromDb.current) {
      const userRef = doc(db, 'usuarios', currentUser.uid)
      setDoc(userRef, { carrito }, { merge: true })
        .catch(err => console.error("Error al sincronizar carrito:", err))
    }
  }, [carrito, currentUser])

  useEffect(() => {
    if (productoParaVer) {
      setMostrarIndicador(true)
      const t = setTimeout(() => setMostrarIndicador(false), 3000)
      return () => clearTimeout(t)
    }
  }, [indexImagenActual, productoParaVer])

  useEffect(() => {
    if (expandedImage) {
      setMostrarControlesZoom(true)
      const t = setTimeout(() => setMostrarControlesZoom(false), 2000)
      return () => clearTimeout(t)
    }
  }, [expandedImage, indexImagenActual])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified) {
        if (!isRegistering.current) {
          await signOut(auth)
          setCurrentUser(null)
          setUserData(null)
          setCarrito([])
          lastLoadedUid.current = null
          loadingCartFromDb.current = false
          return
        }
      }

      setCurrentUser(user)
      if (user) {
        if (lastLoadedUid.current !== user.uid) {
          loadingCartFromDb.current = true
          lastLoadedUid.current = user.uid
        }
        
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid))
          let dbCart = []
          if (userDoc.exists()) {
            const data = userDoc.data()
            setUserData(data)
            
            // Si el correo está verificado en Auth pero no en Firestore, lo actualizamos
            if (data.emailVerified !== true) {
              await setDoc(doc(db, 'usuarios', user.uid), { emailVerified: true }, { merge: true })
              data.emailVerified = true
              setUserData({ ...data })
            }
            
            // Pre-llenar checkout
            setClienteNombre(user.displayName || '')
            setClienteWhatsapp(data.whatsapp || '')
            dbCart = data.carrito || []
          } else {
            setClienteNombre(user.displayName || '')
          }
          
          setCarrito(prev => {
            const merged = mergeCarts(prev, dbCart)
            localStorage.setItem('carritoLeis', JSON.stringify(merged))
            loadingCartFromDb.current = false
            return merged
          })
        } catch (e) {
          console.error("Error cargando perfil", e)
          loadingCartFromDb.current = false
        }
      } else {
        setUserData(null)
        setClienteNombre('')
        setClienteWhatsapp('')
        setCarrito([])
        lastLoadedUid.current = null
        loadingCartFromDb.current = false
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    // Escuchar productos en tiempo real
    const unsub = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Ordenar alfabéticamente
      data.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProductos(data)
      setLoading(false)
    })
    return unsub
  }, [])

  // --- DERIVADOS ---
  const productosVisibles = productos.filter(p => p.visibleEnCatalogo !== false)

  const categoriasUnicas = ['TODAS', ...new Set(productosVisibles.map(p => (p.coleccion || '').trim().toUpperCase()).filter(Boolean))].sort((a, b) => {
    if (a === 'TODAS') return -1;
    if (b === 'TODAS') return 1;
    return a.localeCompare(b);
  })

  const productosFiltrados = productosVisibles.filter(p => {
    if (filtroCategoria !== 'TODAS' && (p.coleccion || '').trim().toUpperCase() !== filtroCategoria) return false;
    
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      const matchNombre = (p.nombre || '').toLowerCase().includes(s);
      const matchSku = (p.sku || '').toLowerCase().includes(s);
      const matchMarca = (p.marca || '').toLowerCase().includes(s);
      if (!(matchNombre || matchSku || matchMarca)) return false;
    }

    if (precioMin !== '' && p.precio < Number(precioMin)) return false;
    if (precioMax !== '' && p.precio > Number(precioMax)) return false;

    if (soloDisponibles) {
      const tieneStock = p.variantes && p.variantes.length > 0 
        ? p.variantes.some(v => Number(v.stock) > 0)
        : Number(p.stock) > 0;
      if (!tieneStock) return false;
    }

    return true;
  })

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setIsAuthLoading(true)

    try {
      if (authTab === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, authForm.email, authForm.password)
        if (!userCred.user.emailVerified) {
          const now = Date.now()
          const lastSent = Number(localStorage.getItem('lastVerificationSent_') || '0')
          if (now - lastSent < 60000) {
            await signOut(auth)
            throw new Error("unverified-email-cooldown")
          } else {
            await sendEmailVerification(userCred.user)
            localStorage.setItem('lastVerificationSent_', String(now))
            await signOut(auth)
            throw new Error("unverified-email-sent")
          }
        }
        setShowAuthModal(false)
      } else {
        if (!authForm.nombre.trim()) throw new Error("El nombre es obligatorio")
        if (!authForm.whatsapp.trim()) throw new Error("El número de WhatsApp es obligatorio")
        
        // Verificar que el número de WhatsApp sea único (con depuración perezosa de fantasmas expirados > 30 min)
        const normalizedWhatsapp = authForm.whatsapp.trim()
        const q = query(collection(db, 'usuarios'), where('whatsapp', '==', normalizedWhatsapp))
        const querySnapshot = await getDocs(q)
        
        let whatsappBloqueado = false
        if (!querySnapshot.empty) {
          for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data()
            const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0
            const ahora = Date.now()
            
            // Si el usuario registrado anterior no verificó su correo y pasaron más de 30 minutos (1800000 ms), lo borramos
            if (data.emailVerified === false && (ahora - createdAt > 1800000)) {
              await deleteDoc(doc(db, 'usuarios', docSnap.id))
            } else {
              whatsappBloqueado = true
            }
          }
        }
        
        if (whatsappBloqueado) {
          throw new Error("Este número de WhatsApp ya está registrado con otra cuenta activa.")
        }
        
        isRegistering.current = true
        
        try {
          const userCred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password)
          
          // Enviar correo de verificación
          await sendEmailVerification(userCred.user)
          localStorage.setItem('lastVerificationSent_', String(Date.now()))
          
          // Actualizar el displayName
          await updateProfile(userCred.user, { displayName: authForm.nombre })
          
          // Guardar whatsapp en firestore con emailVerified: false
          await setDoc(doc(db, 'usuarios', userCred.user.uid), {
            nombre: authForm.nombre,
            email: authForm.email,
            whatsapp: authForm.whatsapp,
            emailVerified: false,
            createdAt: new Date().toISOString()
          })
          
          await signOut(auth)
          
          setAuthSuccess("¡Registro exitoso! Te hemos enviado un enlace de verificación. Por favor, verifica tu cuenta antes de iniciar sesión.")
          setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' })
          setAuthTab('login')
        } finally {
          isRegistering.current = false
        }
      }
    } catch (error) {
      console.error(error)
      if (error.message === "unverified-email-cooldown") {
        setAuthError("Tu correo electrónico no está verificado. Por favor, revisa tu bandeja de entrada (ya enviamos un enlace hace poco; espera un minuto antes de reintentar).")
      } else if (error.message === "unverified-email-sent") {
        setAuthError("Tu correo electrónico no está verificado. Hemos enviado un nuevo enlace de verificación a tu bandeja de entrada.")
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este correo ya está registrado. Si aún no lo has verificado, intenta iniciar sesión para recibir un nuevo enlace de activación.')
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError('Credenciales incorrectas.')
      } else if (error.code === 'auth/user-not-found') {
        setAuthError('No hay cuenta con este correo.')
      } else if (error.code === 'auth/weak-password') {
        setAuthError('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setAuthError(error.message || 'Error al autenticar')
      }
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setShowProfileMenu(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setEditProfileError('')
    setEditProfileSuccess('')
    setIsEditProfileLoading(true)

    try {
      if (!editProfileForm.nombre.trim()) throw new Error("El nombre es obligatorio")
      if (!editProfileForm.whatsapp.trim()) throw new Error("El número de WhatsApp es obligatorio")

      const newNombre = editProfileForm.nombre.trim()
      const newWhatsapp = editProfileForm.whatsapp.trim()

      if (newWhatsapp !== (userData?.whatsapp || '')) {
        const q = query(collection(db, 'usuarios'), where('whatsapp', '==', newWhatsapp))
        const querySnapshot = await getDocs(q)
        
        let whatsappBloqueado = false
        if (!querySnapshot.empty) {
          for (const docSnap of querySnapshot.docs) {
            if (docSnap.id === currentUser.uid) continue;
            
            const data = docSnap.data()
            const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0
            const ahora = Date.now()
            
            // Si el otro usuario no está verificado y pasaron más de 30 minutos, lo borramos de Firestore
            if (data.emailVerified === false && (ahora - createdAt > 1800000)) {
              await deleteDoc(doc(db, 'usuarios', docSnap.id))
            } else {
              whatsappBloqueado = true
            }
          }
        }
        
        if (whatsappBloqueado) {
          throw new Error("Este número de WhatsApp ya está registrado con otra cuenta activa.")
        }
      }

      // Actualizar Perfil en Auth
      await updateProfile(currentUser, { displayName: newNombre })
      
      // Actualizar en Firestore
      await setDoc(doc(db, 'usuarios', currentUser.uid), {
        nombre: newNombre,
        whatsapp: newWhatsapp
      }, { merge: true })

      // Sincronizar estados locales
      setUserData(prev => ({ ...prev, nombre: newNombre, whatsapp: newWhatsapp }))
      setClienteNombre(newNombre)
      setClienteWhatsapp(newWhatsapp)

      setEditProfileSuccess("¡Perfil actualizado con éxito!")
      setTimeout(() => {
        setShowEditProfileModal(false)
        setEditProfileSuccess('')
      }, 1500)
    } catch (err) {
      console.error(err)
      setEditProfileError(err.message || 'Error al actualizar el perfil')
    } finally {
      setIsEditProfileLoading(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    setDeleteAccountError('')
    setDeleteAccountSuccess('')
    setIsDeleteAccountLoading(true)

    try {
      if (!deletePassword) throw new Error("La contraseña es obligatoria")

      // 1. Re-autenticar al usuario para evitar errores de sesión expirada (requires-recent-login)
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword)
      await reauthenticateWithCredential(currentUser, credential)

      const uid = currentUser.uid

      // 2. Borrar documento de Firestore
      await deleteDoc(doc(db, 'usuarios', uid))

      // 3. Borrar de Firebase Auth
      await deleteUser(currentUser)

      // 4. Limpiar sesión y estados locales
      setCarrito([])
      localStorage.removeItem('carritoLeis')
      setCurrentUser(null)
      setUserData(null)
      setClienteNombre('')
      setClienteWhatsapp('')
      lastLoadedUid.current = null
      loadingCartFromDb.current = false
      setDeletePassword('')

      setDeleteAccountSuccess("¡Tu cuenta ha sido eliminada permanentemente!")
      setTimeout(() => {
        setShowDeleteAccountModal(false)
        setDeleteAccountSuccess('')
      }, 2000)
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteAccountError('La contraseña introducida es incorrecta.')
      } else {
        setDeleteAccountError(err.message || 'Error al eliminar la cuenta')
      }
    } finally {
      setIsDeleteAccountLoading(false)
    }
  }

  const handleSendResetEmailLoggedIn = async () => {
    setIsResetEmailLoading(true)
    setResetEmailSuccess('')
    setResetEmailError('')
    try {
      await sendPasswordResetEmail(auth, currentUser.email)
      setResetEmailSuccess(`Se ha enviado un correo a ${currentUser.email} para restablecer tu contraseña.`)
      setTimeout(() => {
        setShowResetPasswordModal(false)
        setResetEmailSuccess('')
      }, 3500)
    } catch (error) {
      console.error(error)
      setResetEmailError(error.message || 'Error al enviar el correo de recuperación.')
    } finally {
      setIsResetEmailLoading(false)
    }
  }

  const handleSendResetEmailForgot = async (e) => {
    e.preventDefault()
    setIsResetEmailLoading(true)
    setResetEmailSuccess('')
    setResetEmailError('')
    try {
      if (!forgotEmail.trim()) throw new Error("El correo es obligatorio")
      await sendPasswordResetEmail(auth, forgotEmail.trim())
      setResetEmailSuccess(`Se ha enviado un correo a ${forgotEmail.trim()} para restablecer tu contraseña.`)
      setForgotEmail('')
      setTimeout(() => {
        setAuthTab('login')
        setResetEmailSuccess('')
      }, 4500)
    } catch (error) {
      console.error(error)
      if (error.code === 'auth/user-not-found') {
        setResetEmailError('No hay ninguna cuenta registrada con este correo electrónico.')
      } else {
        setResetEmailError(error.message || 'Error al enviar el correo de recuperación.')
      }
    } finally {
      setIsResetEmailLoading(false)
    }
  }

  const fotosProducto = productoParaVer?.fotos || (productoParaVer?.fotoUrl ? [productoParaVer.fotoUrl] : []);

  function anteriorImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('salir-derecha');
    setTimeout(() => {
      setIndexImagenActual(prev => (prev === 0 ? fotosProducto.length - 1 : prev - 1));
      setAnimacion('entrar-izquierda');
      setTimeout(() => setAnimacion(''), 300);
    }, 300);
  }

  function siguienteImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('salir-izquierda');
    setTimeout(() => {
      setIndexImagenActual(prev => (prev === fotosProducto.length - 1 ? 0 : prev + 1));
      setAnimacion('entrar-derecha');
      setTimeout(() => setAnimacion(''), 300);
    }, 300);
  }

  useEffect(() => {
    setIndexImagenActual(0);
    setAnimacion('');
  }, [productoParaVer]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!productoParaVer) return;
      if (e.key === 'ArrowLeft') anteriorImagen();
      if (e.key === 'ArrowRight') siguienteImagen();
      if (e.key === 'Escape') setProductoParaVer(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productoParaVer, fotosProducto, animacion]);

  // Lógica de Swipe para móviles
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  // Estados para ZOOM y PAN en el visor ampliado
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 });
  const [distanciaInicial, setDistanciaInicial] = useState(0);

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!expandedImage) resetZoom();
  }, [expandedImage, indexImagenActual]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2 && expandedImage) {
      // Inicio de Pinch
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      setDistanciaInicial(dist);
      return;
    }

    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    
    if (scale > 1) {
      setLastTouch({ x: e.touches[0].pageX, y: e.touches[0].pageY });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && expandedImage) {
      // Lógica de Pinch Zoom
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (distanciaInicial > 0) {
        const delta = dist / distanciaInicial;
        setScale(prev => Math.min(Math.max(1, prev * delta), 4));
      }
      setDistanciaInicial(dist);
      return;
    }

    if (scale > 1 && expandedImage) {
      // Lógica de Pan (Desplazamiento) cuando hay zoom
      const deltaX = e.touches[0].pageX - lastTouch.x;
      const deltaY = e.touches[0].pageY - lastTouch.y;
      setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastTouch({ x: e.touches[0].pageX, y: e.touches[0].pageY });
      return;
    }

    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    setDistanciaInicial(0);
    if (scale > 1) return; // No navegar si estamos en modo zoom

    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) siguienteImagen();
    if (isRightSwipe) anteriorImagen();
  };

  const [paginaActual, setPaginaActual] = useState(1)
  const ITEMS_POR_PAGINA = 20

  useEffect(() => {
    setPaginaActual(1)
  }, [filtroCategoria])

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [paginaActual])

  const totalPaginas = Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA)
  const productosPaginados = productosFiltrados.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA)

  // Lógica de paginación (mostrar máximo 3 páginas)
  const paginasVisibles = []
  let inicioPag = Math.max(1, paginaActual - 1)
  let finPag = Math.min(totalPaginas, paginaActual + 1)

  if (finPag - inicioPag < 2 && totalPaginas >= 3) {
    if (inicioPag === 1) finPag = 3
    else if (finPag === totalPaginas) inicioPag = totalPaginas - 2
  }

  for (let i = inicioPag; i <= finPag; i++) {
    paginasVisibles.push(i)
  }

  // --- LÓGICA DEL CARRITO ---

  const animateFlyToCart = (e, fotoUrl) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    const headerCartBtn = document.getElementById('header-cart-btn');
    const mobileCartFab = document.getElementById('mobile-cart-fab');
    
    let target = null;
    if (mobileCartFab && window.getComputedStyle(mobileCartFab).display !== 'none') {
      target = mobileCartFab;
    } else if (headerCartBtn) {
      target = headerCartBtn;
    }
    
    if (!target) return;
    
    const targetRect = target.getBoundingClientRect();
    
    const flyer = document.createElement('div');
    flyer.className = 'flyer-dot';
    
    flyer.style.position = 'fixed';
    flyer.style.top = `${rect.top + rect.height / 2 - 16}px`;
    flyer.style.left = `${rect.left + rect.width / 2 - 16}px`;
    flyer.style.width = '32px';
    flyer.style.height = '32px';
    flyer.style.borderRadius = '50%';
    flyer.style.zIndex = '9999';
    flyer.style.pointerEvents = 'none';
    
    if (fotoUrl) {
      flyer.style.backgroundImage = `url(${fotoUrl})`;
      flyer.style.backgroundSize = 'cover';
      flyer.style.backgroundPosition = 'center';
      flyer.style.boxShadow = '0 8px 24px rgba(226, 189, 108, 0.4)';
      flyer.style.border = '2px solid #e2bd6c';
    } else {
      flyer.style.backgroundColor = '#e2bd6c';
      flyer.style.boxShadow = '0 0 12px #e2bd6c, 0 0 4px #e2bd6c';
    }
    
    document.body.appendChild(flyer);
    
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    
    flyer.animate([
      {
        transform: 'scale(1) translate(0, 0)',
        opacity: 1
      },
      {
        transform: `scale(0.8) translate(${(endX - startX) * 0.4}px, ${(endY - startY) * 0.1 - 100}px)`,
        opacity: 0.95
      },
      {
        transform: `scale(0.3) translate(${endX - startX}px, ${endY - startY}px)`,
        opacity: 0.3
      }
    ], {
      duration: 750,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      fill: 'forwards'
    });
    
    setTimeout(() => {
      flyer.remove();
      target.classList.add('animate-cart-pop');
      setTimeout(() => {
        target.classList.remove('animate-cart-pop');
      }, 500);
    }, 750);
  };

  function abrirModalAñadir(p) {
    if (p.variantes && p.variantes.length > 0) {
      setProductParaAñadir(p)
      setVarianteSeleccionada('')
    } else {
      añadirAlCarrito(p, null)
    }
  }

  function añadirAlCarrito(producto, variante) {
    if (tourStep === 3) {
      setTourStep(4)
    }
    const maxStock = variante ? variante.stock : producto.stock
    const nombreItem = variante ? `${producto.nombre} (${variante.nombre})` : producto.nombre
    const idCart = variante ? `${producto.id}-${variante.nombre}` : producto.id

    setCarrito(prev => {
      const existente = prev.find(item => item.idCart === idCart)
      if (existente) {
        if (existente.cantidad >= maxStock) {
          alert('No hay más stock disponible para este producto.')
          return prev
        }
        return prev.map(item => 
          item.idCart === idCart 
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      } else {
        return [...prev, {
          idCart,
          productoId: producto.id,
          nombre: nombreItem,
          precio: producto.precio || 0,
          cantidad: 1,
          maxStock: Number(maxStock),
          fotoUrl: producto.fotoUrl || '',
          marca: producto.marca || ''
        }]
      }
    })
    
    setProductParaAñadir(null)
  }

  function actualizarCantidad(idCart, delta) {
    setCarrito(prev => prev.map(item => {
      if (item.idCart === idCart) {
        const nuevaCantidad = item.cantidad + delta
        if (nuevaCantidad > item.maxStock) {
          alert('Has alcanzado el límite de stock disponible.')
          return item
        }
        // La eliminación (cantidad < 1) ahora la manejamos explícitamente en UI, pero si llega por error:
        if (nuevaCantidad < 1) return item 
        return { ...item, cantidad: nuevaCantidad }
      }
      return item
    }))
  }

  function eliminarDelCarrito(idCart) {
    setCarrito(prev => prev.filter(item => item.idCart !== idCart))
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0)

  function scrollCategories(direction) {
    if (categoryContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      categoryContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  // --- WHATSAPP CHECKOUT ---
  
  function prepararCheckout() {
    if (carrito.length === 0) return alert('El carrito está vacío')
    setShowCheckout(true)
    setIsCartOpen(false)
    if (tourStep === 5) {
      setTourStep(6)
    }
  }

  function enviarPedidoWhatsApp() {
    if (!clienteNombre.trim()) return alert('Por favor ingresa tu nombre')

    let texto = `*NUEVO PEDIDO - CATÁLOGO ONLINE*%0A%0A`
    texto += `*Cliente:* ${clienteNombre}%0A`
    if (clienteWhatsapp) {
      texto += `*Teléfono Contacto:* ${clienteWhatsapp}%0A`
    }
    texto += `*Detalle del pedido:*%0A%0A`

    carrito.forEach(item => {
      texto += `- ${item.cantidad}x ${item.nombre} ($${(item.precio * item.cantidad).toLocaleString('es-CL')})%0A`
    })

    texto += `%0A*TOTAL: $${totalCarrito.toLocaleString('es-CL')}*%0A%0A`
    texto += `_Me gustaría confirmar la disponibilidad de estos productos y coordinar el pago._`

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${texto}`
    window.open(url, '_blank')
    
    setCarrito([])
    setShowCheckout(false)
    setClienteNombre('')

    if (tourStep === 6) {
      setTourStep(7)
      setTimeout(() => {
        setTourStep(0)
      }, 7000)
    }
  }

  // Obtener categorías únicas de los productos actualmente en el carrito (incluyendo 'TODOS' siempre al inicio)
  const categoriasEnCarrito = [
    'TODOS',
    ...new Set(carrito.map(item => {
      const pObj = productos.find(p => p.id === item.productoId);
      return pObj?.coleccion ? pObj.coleccion.trim().toUpperCase() : 'JOYAS';
    }))
  ];

  // Resetear el filtro de categorías al cerrar el carrito
  useEffect(() => {
    if (!isCartOpen) {
      setFiltroCartCategory('TODOS')
    }
  }, [isCartOpen])

  // --- RENDER ---

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-surface text-on-surface">Cargando catálogo...</div>
  }

  return (
    <div className={`flex h-[100dvh] ${isDark ? 'bg-[#0c0c0c]' : 'bg-surface'} relative overflow-hidden transition-colors duration-500`}>
      
      {/* ── BACKGROUND WATERMARK ── */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center transition-opacity duration-500 ${isDark ? 'opacity-10' : 'opacity-15'}`}>
        <div className="w-[85%] md:w-[40%] max-w-lg rounded-[3.5rem] crystal-effect">
          <img 
            src={isDark ? "/logo-dark.png" : "/logo.jpeg"} 
            alt="Watermark" 
            className={`w-full h-full object-contain rounded-[3.5rem] shadow-sm transition-all duration-500 ${isDark ? 'mix-blend-overlay' : 'mix-blend-multiply'}`}
          />
        </div>
      </div>

      {/* OVERLAY MÓVIL PARA SIDEBAR */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── PANEL LATERAL (SIDEBAR) ── */}
      <aside className={`fixed md:relative top-0 left-0 h-full border-r z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl md:shadow-none 
        ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'} 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
        ${isSidebarCollapsed ? 'md:w-0 md:-translate-x-full md:border-r-transparent' : 'md:w-[280px] md:translate-x-0'}`}
      >
        <div className={`flex-1 flex flex-col h-full min-w-[280px] transition-all duration-500 ${isSidebarCollapsed ? 'md:opacity-0 md:pointer-events-none' : 'opacity-100'}`}>
          {/* CABECERA SIDEBAR */}
          <div className={`p-6 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/20 bg-surface-container-low'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg shadow-sm flex items-center justify-center p-1 shrink-0 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                <img src={isDark ? "/logo-dark.png" : "/logo.jpeg"} alt="Logo" className="w-full h-full object-contain rounded" />
              </div>
              <div>
                <h1 className={`font-headline text-lg font-bold italic leading-tight ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>Catálogo</h1>
                <p className={`text-[9px] uppercase tracking-widest font-bold ${isDark ? 'text-[#e2bd6c]/60' : 'text-outline'}`}>Filtros</p>
              </div>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className={`md:hidden p-2 rounded-full transition-colors ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-outline hover:bg-surface-variant'}`}>
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* CONTENIDO SIDEBAR (FILTROS) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* BÚSQUEDA */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsBusquedaExpanded(!isBusquedaExpanded)}
                className="w-full flex items-center justify-between py-1 cursor-pointer select-none group focus:outline-none"
              >
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'} group-hover:text-[#e2bd6c] transition-colors`}>
                  <span className="material-symbols-outlined text-sm">search</span>
                  Búsqueda
                </h3>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isBusquedaExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {isBusquedaExpanded && (
                <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                  <input 
                    type="text" 
                    placeholder="Nombre, SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full border rounded-xl pl-4 pr-10 py-3 text-sm font-medium focus:outline-none focus:ring-4 transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50 focus:ring-[#e2bd6c]/5' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50 focus:ring-primary/5'} ${tourStep === 2 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-[1.02]' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(67,56,202,0.8)] scale-[1.02]') : ''}`}
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-outline-variant/30 text-outline hover:bg-outline-variant/50 transition-all"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* PRECIO */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsPrecioExpanded(!isPrecioExpanded)}
                className="w-full flex items-center justify-between py-1 cursor-pointer select-none group focus:outline-none"
              >
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'} group-hover:text-[#e2bd6c] transition-colors`}>
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Rango de Precio
                </h3>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isPrecioExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {isPrecioExpanded && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="relative flex-1">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-gray-400' : 'text-outline'}`}>$</span>
                    <input 
                      type="number" 
                      placeholder="Min"
                      value={precioMin}
                      onChange={e => setPrecioMin(e.target.value)}
                      className={`w-full border rounded-xl pl-7 pr-2 py-2.5 text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50'}`}
                    />
                  </div>
                  <span className={isDark ? 'text-white/20' : 'text-outline-variant'}>-</span>
                  <div className="relative flex-1">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-gray-400' : 'text-outline'}`}>$</span>
                    <input 
                      type="number" 
                      placeholder="Max"
                      value={precioMax}
                      onChange={e => setPrecioMax(e.target.value)}
                      className={`w-full border rounded-xl pl-7 pr-2 py-2.5 text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50'}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* DISPONIBILIDAD */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsDisponibilidadExpanded(!isDisponibilidadExpanded)}
                className="w-full flex items-center justify-between py-1 cursor-pointer select-none group focus:outline-none"
              >
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'} group-hover:text-[#e2bd6c] transition-colors`}>
                  <span className="material-symbols-outlined text-sm">inventory_2</span>
                  Disponibilidad
                </h3>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isDisponibilidadExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {isDisponibilidadExpanded && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-variant/50'}`}>
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-on-surface'}`}>Solo disponible</span>
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={soloDisponibles}
                        onChange={e => setSoloDisponibles(e.target.checked)}
                      />
                      <div className={`w-10 h-6 bg-outline-variant/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isDark ? 'peer-checked:bg-[#e2bd6c]' : 'peer-checked:bg-primary'}`}></div>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* CATEGORÍAS */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsCategoriasExpanded(!isCategoriasExpanded)}
                className="w-full flex items-center justify-between py-1 cursor-pointer select-none group focus:outline-none"
              >
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'} group-hover:text-[#e2bd6c] transition-colors`}>
                  <span className="material-symbols-outlined text-sm">category</span>
                  Categorías
                </h3>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isCategoriasExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {isCategoriasExpanded && (
                <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  {categoriasUnicas.map(c => (
                    <button
                      key={c}
                      onClick={() => {
                        setFiltroCategoria(c)
                        if (window.innerWidth < 768) setIsSidebarOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all duration-300 relative group overflow-hidden border cursor-pointer
                        ${filtroCategoria === c
                          ? (isDark 
                              ? 'bg-gradient-to-r from-[#e2bd6c]/20 to-[#e2bd6c]/5 border-[#e2bd6c]/40 text-[#e2bd6c] shadow-[0_0_15px_rgba(226,189,108,0.15)] scale-[1.02]' 
                              : 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 text-primary scale-[1.02]')
                          : (isDark 
                              ? 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/5' 
                              : 'bg-transparent border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40 hover:border-surface-variant/10')
                        }`}
                    >
                      {/* Left line indicator for active category */}
                      {filtroCategoria === c && (
                        <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-md ${isDark ? 'bg-[#e2bd6c]' : 'bg-primary'}`} />
                      )}
                      
                      <div className="flex items-center gap-3">
                        <span className={`material-symbols-outlined text-[16px] transition-transform duration-500 group-hover:rotate-[15deg] ${filtroCategoria === c ? (isDark ? 'text-[#e2bd6c]' : 'text-primary') : 'text-gray-500 group-hover:text-gray-300'}`}>
                          {getCategoriaIcon(c)}
                        </span>
                        <span className="font-semibold tracking-widest text-[10px]">{c}</span>
                      </div>
                      
                      {filtroCategoria === c ? (
                        <span className={`material-symbols-outlined text-sm ${isDark ? 'text-[#e2bd6c]' : 'text-primary'} animate-pulse`}>check</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm opacity-0 group-hover:opacity-40 group-hover:translate-x-0.5 transition-all text-gray-500">chevron_right</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
          
          {/* FOOTER SIDEBAR */}
          <div className={`p-6 border-t shrink-0 ${isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/20 bg-surface-container-lowest'}`}>
            <button 
              onClick={() => {
                setFiltroCategoria('TODAS')
                setSearchTerm('')
                setPrecioMin('')
                setPrecioMax('')
                setSoloDisponibles(false)
              }}
              className={`w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer ${isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-outline-variant/30 text-on-surface hover:bg-surface-variant'}`}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </aside>

      {/* Botón Toggle Flotante (Círculo en el Borde de la Sidebar Desktop) */}
      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        title={isSidebarCollapsed ? 'Mostrar filtros' : 'Ocultar filtros'}
        className={`hidden md:flex fixed top-1/2 z-[60] w-8 h-8 items-center justify-center rounded-full shadow-lg border hover:scale-110 active:scale-95 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group -translate-y-1/2 -translate-x-1/2 cursor-pointer
          ${isDark 
            ? 'bg-[#1e1e1e] border-white/10 text-[#e2bd6c] hover:bg-[#e2bd6c] hover:text-black shadow-black/40' 
            : 'bg-white border-outline-variant/30 text-secondary hover:bg-secondary hover:text-white shadow-black/10'}
          ${isSidebarCollapsed ? 'left-0' : 'left-[280px]'}`}
      >
        <span className={`material-symbols-outlined text-sm font-bold transition-transform duration-500 ${isSidebarCollapsed ? 'rotate-0' : 'rotate-180'}`}>
          chevron_right
        </span>
      </button>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* HEADER PRINCIPAL COMPACTO */}
        <header className={`sticky top-0 z-30 backdrop-blur-md px-4 py-4 md:px-8 md:py-6 border-b flex items-center justify-between shrink-0 transition-colors duration-500 ${isDark ? 'bg-[#0c0c0c]/80 border-white/5' : 'bg-white/80 border-outline-variant/20'}`}>
          <div className="w-16 shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`md:hidden w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${isDark ? 'bg-white/5 text-white' : 'bg-surface-variant text-on-surface'}`}
            >
              <span className="material-symbols-outlined">menu_open</span>
            </button>
          </div>

          <div className="flex-1 hidden md:flex justify-center">
            <h2 className={`font-headline text-lg md:text-2xl font-bold italic leading-tight text-center ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
              {filtroCategoria === 'TODAS' ? 'Todos los Productos' : filtroCategoria}
              <span className={`ml-2 text-sm font-sans font-normal not-italic ${isDark ? 'text-gray-400' : 'text-outline'}`}>({productosFiltrados.length})</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón de Apariencia (Modo Oscuro/Claro) */}
            <button 
              onClick={() => setIsDark(!isDark)}
              className={`p-3 rounded-2xl transition-colors shrink-0 ${isDark ? 'bg-white/5 text-[#e2bd6c] hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'}`}
              title={isDark ? "Modo Claro" : "Modo Oscuro"}
            >
              <span className="material-symbols-outlined">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {currentUser ? (
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c] hover:bg-[#e2bd6c]/20' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}
                >
                  <span className="font-bold text-sm">{currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}</span>
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-[110]" onClick={() => setShowProfileMenu(false)} />
                    <div className={`absolute right-0 top-full mt-2 w-48 border rounded-2xl shadow-xl z-[120] py-2 animate-in fade-in slide-in-from-top-2 ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-surface-container-lowest border-outline-variant/20'}`}>
                      <div className={`px-4 py-2 border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
                        <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-on-surface'}`}>{currentUser.displayName}</p>
                        <p className={`text-[10px] truncate ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>{currentUser.email}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditProfileForm({
                            nombre: currentUser.displayName || '',
                            whatsapp: userData?.whatsapp || ''
                          })
                          setEditProfileError('')
                          setEditProfileSuccess('')
                          setShowEditProfileModal(true)
                          setShowProfileMenu(false)
                        }}
                        className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 border-b ${isDark ? 'text-white border-white/5 hover:bg-white/5' : 'text-on-surface border-outline-variant/10 hover:bg-surface-variant/20'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar Perfil
                      </button>
                      <button 
                        onClick={() => {
                          setResetEmailSuccess('')
                          setResetEmailError('')
                          setShowResetPasswordModal(true)
                          setShowProfileMenu(false)
                        }}
                        className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 border-b ${isDark ? 'text-white border-white/5 hover:bg-white/5' : 'text-on-surface border-outline-variant/10 hover:bg-surface-variant/20'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                        Restablecer Contraseña
                      </button>
                      <button 
                        onClick={handleLogout}
                        className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/20'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        Cerrar Sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className={`p-3 rounded-2xl transition-all shrink-0 ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'} ${tourStep === 2 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-110' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(67,56,202,0.8)] scale-110') : ''}`}
                title="Iniciar Sesión / Crear Cuenta"
              >
                <span className="material-symbols-outlined">person</span>
              </button>
            )}

            <button 
              onClick={() => {
                setShowTutorial(prev => {
                  const newVal = !prev;
                  if (!newVal) {
                    localStorage.setItem('hide_catalogo_tutorial', 'true');
                  } else {
                    localStorage.removeItem('hide_catalogo_tutorial');
                  }
                  return newVal;
                });
              }}
              className={`p-3 rounded-2xl transition-colors shrink-0 ml-1 ${showTutorial ? (isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/20 text-primary') : (isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant')}`}
              title="Guía de Compra / Ayuda"
            >
              <span className="material-symbols-outlined">help</span>
            </button>

            <button 
              id="header-cart-btn"
              onClick={() => setIsCartOpen(true)}
              className={`relative p-3 rounded-2xl transition-all shrink-0 ml-1 ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c] hover:bg-[#e2bd6c]/20' : 'bg-primary/10 text-primary hover:bg-primary/20'} ${tourStep === 4 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_25px_rgba(226,189,108,0.9)] scale-110' : 'ring-4 ring-primary animate-pulse shadow-[0_0_25px_rgba(67,56,202,0.9)] scale-110') : ''}`}
            >
              <span className="material-symbols-outlined">shopping_cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-error text-on-error text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md animate-in zoom-in">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* MAIN SCROLLABLE AREA */}
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10 pb-32 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {/* Título de categoría solo para celulares */}
            <div className="md:hidden mb-6 flex justify-between items-center px-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <h1 className={`font-headline text-2xl font-bold italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                {filtroCategoria === 'TODAS' ? 'Todos los Productos' : filtroCategoria}
              </h1>
              <span className={`text-xs font-sans font-normal not-italic px-3 py-1 rounded-full ${isDark ? 'bg-white/5 text-gray-400' : 'bg-surface-container-high text-outline'}`}>
                {productosFiltrados.length} {productosFiltrados.length === 1 ? 'producto' : 'productos'}
              </span>
            </div>

            {/* ── TUTORIAL INTERACTIVO DE PASOS PARA PEDIDOS ── */}
            {showTutorial && (
              <div className={`mb-8 p-6 md:p-8 rounded-[2rem] border relative overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-top-4 duration-700 ${isDark ? 'bg-[#151515]/90 border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]' : 'bg-white/70 border-outline-variant/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]'} backdrop-blur-md`}>
                {/* Brillos decorativos */}
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#e2bd6c]/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                
                {/* Header del tutorial */}
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className={`font-headline text-lg md:text-2xl font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                      <span className="material-symbols-outlined text-[#e2bd6c] animate-bounce">auto_awesome</span>
                      ¿Cómo realizar tu pedido?
                    </h2>
                    <p className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                      Sigue esta sencilla guía de 3 pasos para asegurar tus productos favoritos al instante.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowTutorial(false);
                      localStorage.setItem('hide_catalogo_tutorial', 'true');
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-surface-variant text-outline hover:text-on-surface'}`}
                    title="Ocultar Guía"
                  >
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Grid de 3 pasos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
                  {/* Paso 1 */}
                  <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex gap-4 ${isDark ? 'bg-white/5 border-white/5 hover:border-[#e2bd6c]/30' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                      <span className="material-symbols-outlined font-bold">add_shopping_cart</span>
                    </div>
                    <div>
                      <h3 className={`font-bold text-xs md:text-sm uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                        1. Agrega al Carrito
                      </h3>
                      <p className={`text-[11px] md:text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                        Explora el catálogo, elige tus productos o variantes ideales y haz clic en **Añadir al Carrito**.
                      </p>
                    </div>
                  </div>

                  {/* Paso 2 */}
                  <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex gap-4 ${isDark ? 'bg-white/5 border-white/5 hover:border-[#e2bd6c]/30' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                      <span className="material-symbols-outlined font-bold">receipt_long</span>
                    </div>
                    <div>
                      <h3 className={`font-bold text-xs md:text-sm uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                        2. Confirma tu Carro
                      </h3>
                      <p className={`text-[11px] md:text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                        Abre tu bolsa de compras arriba a la derecha, revisa tus cantidades y pulsa **Confirmar Pedido**.
                      </p>
                    </div>
                  </div>

                  {/* Paso 3 */}
                  <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex gap-4 ${isDark ? 'bg-white/5 border-white/5 hover:border-[#e2bd6c]/30' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                      <span className="material-symbols-outlined font-bold">chat</span>
                    </div>
                    <div>
                      <h3 className={`font-bold text-xs md:text-sm uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                        3. Envía por WhatsApp
                      </h3>
                      <p className={`text-[11px] md:text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                        Se generará un mensaje automático. Envíalo a la asesora para **confirmar stock al instante** y coordinar el pago.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botones de acción del tutorial */}
                <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
                  <button
                    onClick={() => setTourStep(1)}
                    className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${isDark ? 'bg-[#e2bd6c] text-black shadow-[#e2bd6c]/20' : 'bg-primary text-on-primary shadow-primary/20'}`}
                  >
                    <span className="material-symbols-outlined text-sm animate-pulse">play_circle</span>
                    Iniciar viaje de prueba 🐾
                  </button>

                  <button
                    onClick={() => setShowVideoModal(true)}
                    className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 border cursor-pointer ${
                      isDark 
                        ? 'border-white/10 text-white hover:bg-white/5 bg-white/5 shadow-md shadow-black/20' 
                        : 'border-outline-variant/30 text-on-surface hover:bg-surface-variant bg-surface-container-low shadow-sm'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">smart_display</span>
                    Ver Video Tutorial 🎬
                  </button>
                </div>

              </div>
            )}
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            No hay productos disponibles en esta categoría.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {productosPaginados.map((p, pIndex) => {
                const tieneVariantes = p.variantes && p.variantes.length > 0;
              const cartItem = !tieneVariantes ? carrito.find(item => item.productoId === p.id) : null;
              const totalEnCarritoVariants = tieneVariantes ? carrito.filter(item => item.productoId === p.id).reduce((sum, i) => sum + i.cantidad, 0) : 0;
              const tieneStock = tieneVariantes 
                ? p.variantes.some(v => Number(v.stock) > 0)
                : Number(p.stock) > 0;

              const isStep3Highlight = tourStep === 3 && pIndex === 0;
              const isGrayscaleTour = tourStep === 3 && pIndex !== 0;

              return (
                <div key={p.id} className={`rounded-[24px] overflow-hidden border shadow-sm flex flex-col group hover:shadow-md transition-all ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-surface-container-low border-outline-variant/20'} ${!tieneStock ? 'grayscale opacity-70' : ''} ${isGrayscaleTour ? 'grayscale opacity-30 hover:grayscale-0 hover:opacity-90 duration-500 shadow-none border-dashed' : ''}`}>
                  {/* Imagen */}
                  <div 
                    className={`aspect-square relative overflow-hidden flex items-center justify-center cursor-pointer ${isDark ? 'bg-white/5' : 'bg-white/60'}`}
                    onClick={() => setProductoParaVer(p)}
                  >
                    {p.fotoUrl ? (
                       <img src={p.fotoUrl} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                       <span className={`material-symbols-outlined text-4xl ${isDark ? 'text-white/20' : 'text-outline/30'}`}>image</span>
                    )}
                    {p.marca && (
                      <div className={`absolute top-2 right-2 backdrop-blur-sm px-2 py-1 rounded-md ${isDark ? 'bg-[#151515]/90' : 'bg-white/90'}`}>
                        <span className={`text-[8px] font-bold uppercase tracking-widest ${isDark ? 'text-[#e2bd6c]' : 'text-on-surface'}`}>{p.marca}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 
                      className={`font-headline font-bold text-sm md:text-xl leading-tight line-clamp-2 mb-1 cursor-pointer transition-colors ${isDark ? 'text-white hover:text-[#e2bd6c]' : 'text-on-surface hover:text-primary'}`}
                      onClick={() => setProductoParaVer(p)}
                    >
                      {p.nombre}
                    </h3>
                    <p className={`text-[10px] md:text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-[#e2bd6c]/60' : 'text-outline'}`}>{(p.coleccion || '').toUpperCase()}</p>
                    
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <p className={`font-bold text-base md:text-lg ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>${(p.precio || 0).toLocaleString('es-CL')}</p>
                      
                      {/* LÓGICA DE BOTONES INLINE */}
                      {!tieneStock ? (
                        <span className={`px-3 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase tracking-widest shrink-0 ${isDark ? 'bg-white/5 text-gray-400' : 'bg-surface-variant text-on-surface-variant'}`}>
                          Agotado
                        </span>
                      ) : tieneVariantes ? (
                        <button 
                          onClick={() => abrirModalAñadir(p)}
                          className={`px-3 h-10 rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all text-[10px] font-bold uppercase tracking-widest shrink-0 ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary-fixed-dim'} ${isStep3Highlight ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-110' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(67,56,202,0.8)] scale-110') : ''}`}
                        >
                          Opciones {totalEnCarritoVariants > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-md ${isDark ? 'bg-black/20 text-black/80' : 'bg-white/20 text-on-primary/80'}`}>{totalEnCarritoVariants}</span>}
                        </button>
                      ) : cartItem ? (
                        <div className={`flex items-center gap-1 rounded-xl p-1 h-10 shrink-0 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-surface-container-highest border-outline-variant/20'}`}>
                          <button onClick={() => {
                            if(cartItem.cantidad === 1) eliminarDelCarrito(cartItem.idCart);
                            else actualizarCantidad(cartItem.idCart, -1);
                          }} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-on-surface'}`}>
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className={`w-5 text-center font-bold text-xs ${isDark ? 'text-white' : 'text-on-surface'}`}>{cartItem.cantidad}</span>
                          <button onClick={() => actualizarCantidad(cartItem.idCart, 1)} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-on-surface'}`}>
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => {
                            animateFlyToCart(e, p.fotoUrl);
                            añadirAlCarrito(p, null);
                          }}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all shrink-0 ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary-fixed-dim'} ${isStep3Highlight ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-110' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(67,56,202,0.8)] scale-110') : ''}`}
                        >
                          <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            </div>
            
            {totalPaginas > 1 && (
              <div className="mt-10 flex justify-center items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setPaginaActual(prev => Math.max(prev - 1, 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={paginaActual === 1}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>

                {paginasVisibles.map(pag => (
                  <button
                    key={pag}
                    onClick={() => {
                      setPaginaActual(pag)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold text-sm transition-all ${
                      paginaActual === pag
                        ? (isDark ? 'bg-[#e2bd6c] text-black shadow-md' : 'bg-secondary text-white shadow-md')
                        : (isDark ? 'border border-white/10 text-gray-300 hover:bg-white/5' : 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant')
                    }`}
                  >
                    {pag}
                  </button>
                ))}

                <button
                  onClick={() => {
                    setPaginaActual(prev => Math.min(prev + 1, totalPaginas))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={paginaActual === totalPaginas}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}

            {/* FOOTER DEL CATALOGO */}
            <footer className="mt-16 pt-16 pb-12 border-t border-outline-variant/10 dark:border-white/5 flex flex-col items-center gap-4 opacity-50">
              <div className="flex items-center gap-3">
                <span className={`font-headline font-bold text-sm tracking-tight ${isDark ? 'text-white/80' : 'text-on-surface/80'}`}>Leis Catálogo V1.2</span>
              </div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.3em] text-center ${isDark ? 'text-gray-500' : 'text-outline'}`}>
                "Tu éxito está en nuestros productos"
              </p>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[#e2bd6c]/40' : 'bg-primary/40'}`} />
                <span className={`text-[8px] font-extrabold uppercase tracking-widest text-center ${isDark ? 'text-gray-600' : 'text-outline'}`}>© 2026 Todos los derechos reservados</span>
                <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[#e2bd6c]/40' : 'bg-primary/40'}`} />
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* FAB CARRITO MÓVIL */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-20 md:hidden">
          <button 
            id="mobile-cart-fab"
            onClick={() => setIsCartOpen(true)}
            className="bg-secondary text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold uppercase tracking-widest text-xs animate-in slide-in-from-bottom-10 hover:scale-105 transition-transform"
          >
            <span className="material-symbols-outlined">shopping_bag</span>
            Ver Carrito ({totalItems})
          </button>
        </div>
      )}

      {/* ── NUEVA MAQUETA PREMIUM DEL CARRITO (ESTILO DE LA IMAGEN COMPLETA EN ESPAÑOL) ── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="fixed inset-0" onClick={() => setIsCartOpen(false)} />
          
          <div className={`relative w-full max-w-4xl rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col font-sans transition-all duration-300 ${
            isDark ? 'bg-[#18181b] text-white border border-white/5 shadow-black/90' : 'bg-[#fbf9f4] text-[#2a1b0a] border border-[#e2bd6c]/20'
          }`}>
            
            {/* Cabecera del Carrito (Diseño Exclusivo Leis con Categorías Dinámicas y Botón de Cerrar) */}
            <div className={`px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 border-b shrink-0 ${
              isDark ? 'border-white/5 bg-[#151515]/90' : 'border-[#e2bd6c]/10 bg-[#f4ede1]/30'
            }`}>
              {/* Logo elegante Leis Real */}
              <div className="flex items-center gap-3 select-none">
                <img src="/logo.jpeg" className="w-10 h-10 rounded-full object-cover border border-[#e2bd6c]/30 shadow-md shrink-0" alt="Leis Logo" />
                <div className="flex flex-col">
                  <span className="font-headline font-black text-lg leading-none tracking-wide text-[#5d3a28] dark:text-[#e2bd6c]">LEIS</span>
                  <span className="text-[7px] font-black tracking-widest text-[#8e6d3c] uppercase mt-0.5 leading-none">JOYERÍA & ACCESORIOS</span>
                </div>
              </div>

              {/* Categorías Dinámicas según productos agregados */}
              <div className="hidden sm:flex items-center gap-6 text-[10px] sm:text-xs font-black uppercase tracking-wider select-none">
                {carrito.length === 0 ? (
                  <div className="relative py-1 cursor-default text-[#5d3a28] dark:text-[#e2bd6c]">
                    Mi Bolsa
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d3a28] dark:bg-[#e2bd6c]" />
                  </div>
                ) : (
                  categoriasEnCarrito.map((cat, idx) => {
                    const isSelected = filtroCartCategory === cat;
                    return (
                      <button 
                        key={idx} 
                        onClick={() => setFiltroCartCategory(cat)}
                        className={`relative py-1 cursor-pointer transition-all hover:opacity-80 font-black uppercase tracking-wider border-none bg-transparent ${
                          isSelected ? 'text-[#5d3a28] dark:text-[#e2bd6c]' : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {cat}
                        {isSelected && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d3a28] dark:bg-[#e2bd6c]" />}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Controles de la derecha: Únicamente el botón de cerrar X */}
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsCartOpen(false)} 
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border cursor-pointer ${
                    isDark ? 'text-gray-400 border-white/10 hover:bg-white/5 hover:text-white' : 'text-[#5d3a28] border-gray-300 hover:bg-black/5 hover:text-black'
                  }`}
                  title="Cerrar pestaña"
                >
                  <span className="material-symbols-outlined text-sm font-bold">close</span>
                </button>
              </div>
            </div>

            {/* Cuerpo del Carrito (Dividido en dos columnas principales) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 sm:p-8 overflow-y-auto max-h-[75vh]">
              
              {/* Columna Izquierda: Listado de Productos (md:col-span-7) */}
              <div className="md:col-span-7 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b pb-2 select-none">
                  <span className="font-headline font-bold text-xs uppercase tracking-widest text-gray-500">Producto</span>
                  <div className="flex gap-12 text-xs uppercase tracking-widest text-gray-500">
                    <span>Variante</span>
                    <span>Cantidad</span>
                  </div>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1 scrollbar-thin">
                  {carrito.length === 0 ? (
                    <div className="text-center py-10 opacity-50 flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">shopping_bag</span>
                      <p className="text-xs font-bold text-gray-500">Tu carrito está vacío</p>
                    </div>
                  ) : (
                    (() => {
                      const itemsFiltrados = filtroCartCategory === 'TODOS'
                        ? carrito
                        : carrito.filter(item => {
                            const pObj = productos.find(p => p.id === item.productoId);
                            const cat = pObj?.coleccion ? pObj.coleccion.trim().toUpperCase() : 'JOYAS';
                            return cat === filtroCartCategory;
                          });

                      if (itemsFiltrados.length === 0) {
                        return (
                          <div className="text-center py-10 opacity-50 flex flex-col items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">filter_alt_off</span>
                            <p className="text-xs font-bold text-gray-500">No hay productos en esta categoría</p>
                          </div>
                        );
                      }

                      return itemsFiltrados.map(item => {
                        // Buscar imagen real del producto
                        const pObj = productos.find(p => p.id === item.productoId);
                        const imgUrl = item.fotoUrl || pObj?.fotoUrl;
                        
                        return (
                          <div key={item.idCart} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                            isDark ? 'bg-white/5 border-white/10' : 'bg-white border-[#e2bd6c]/15 shadow-[0_2px_8px_rgba(226,189,108,0.05)]'
                          }`}>
                            {/* Miniatura del producto */}
                            <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border ${isDark ? 'border-white/5 bg-white/5' : 'border-[#e2bd6c]/20 bg-white/50'}`}>
                              {imgUrl ? (
                                <img src={imgUrl} alt={item.nombre} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="material-symbols-outlined text-gray-400 text-lg">image</span>
                                </div>
                              )}
                            </div>

                            {/* Info del producto */}
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-xs sm:text-sm leading-tight truncate ${isDark ? 'text-white' : 'text-[#2a1b0a]'}`}>{item.nombre}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.marca || 'Leis Collection'}</p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className={`text-[11px] font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'}`}>${item.precio.toLocaleString('es-CL')}</span>
                              </div>
                            </div>

                            {/* Selector de cantidad y subtotal */}
                            <div className="flex items-center gap-3 shrink-0">
                              <div className={`flex items-center gap-1.5 rounded-full p-1 border ${
                                isDark ? 'bg-white/5 border-white/10' : 'bg-[#f4ede1] border-[#e2bd6c]/20'
                              }`}>
                                <button onClick={() => {
                                  if(item.cantidad === 1) eliminarDelCarrito(item.idCart);
                                  else actualizarCantidad(item.idCart, -1);
                                }} className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                                  isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white/80 text-[#5d3a28]'
                                }`}>
                                  <span className="material-symbols-outlined text-[12px] font-bold">remove</span>
                                </button>
                                <span className={`w-4 text-center text-[11px] font-black ${isDark ? 'text-white' : 'text-[#2a1b0a]'}`}>{item.cantidad}</span>
                                <button onClick={() => actualizarCantidad(item.idCart, 1)} className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                                  isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white/80 text-[#5d3a28]'
                                }`}>
                                  <span className="material-symbols-outlined text-[12px] font-bold">add</span>
                                </button>
                              </div>
                              
                              <span className={`text-[11px] font-black w-14 text-right ${isDark ? 'text-white' : 'text-[#2a1b0a]'}`}>
                                ${(item.precio * item.cantidad).toLocaleString('es-CL')}
                              </span>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>

                {/* Controles del fondo de la columna izquierda */}
                {carrito.length > 0 && (
                  <div className="flex flex-col gap-3 mt-2 border-t pt-4">
                    {/* Fila de acción compartir */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 dark:border-white/10 text-[#5d3a28] focus:ring-[#5d3a28] w-3.5 h-3.5" />
                        <span className="text-[10px] text-gray-500 font-bold">Acepto los términos de compra de Leis</span>
                      </label>
                      <button className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                        isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-[#5d3a28]/10 border-[#5d3a28]/20 text-[#5d3a28] hover:bg-[#5d3a28]/15'
                      }`}>
                        <span className="material-symbols-outlined text-[12px]">share</span>
                        Compartir Bolsa
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Columna Derecha: Revisión del Carrito (md:col-span-5) */}
              <div className="md:col-span-5">
                <div className={`p-6 rounded-[2rem] border flex flex-col justify-between h-full min-h-[350px] gap-6 ${
                  isDark ? 'bg-[#151515] border-white/5' : 'bg-[#eedec9]/20 border-[#e2bd6c]/30'
                }`}>
                  <div className="space-y-4">
                    {/* Título de Revisión del Carrito */}
                    <h3 className={`font-headline font-bold text-xl ${isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'}`}>
                      Revisión del Carrito
                    </h3>

                    {/* Resumen explicativo (Resumen) */}
                    <div className={`rounded-2xl p-4 border text-[10px] sm:text-[11px] leading-relaxed font-semibold ${
                      isDark ? 'bg-white/5 border-white/5 text-gray-300' : 'bg-white border-[#e2bd6c]/20 text-[#2a1b0a]/80 shadow-[0_2px_10px_rgba(226,189,108,0.05)]'
                    }`}>
                      <p className={`font-bold mb-1 uppercase tracking-wider ${isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'}`}>Resumen</p>
                      Revisa tu producto en el carrito. Nos aseguramos de empacar cada artículo con el máximo cuidado y amor. La confirmación generará un resumen para que nuestro asesor verifique tu stock al instante.
                    </div>

                    {/* Desglose de Precios */}
                    <div className="space-y-2 pt-2 border-t border-dashed border-gray-300 dark:border-white/10">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-bold">Subtotal de Compra:</span>
                        <span className={`font-mono font-bold ${isDark ? 'text-white' : 'text-[#2a1b0a]'}`}>
                          ${totalCarrito.toLocaleString('es-CL')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fila del Total a Pagar y Botón de Confirmación */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex justify-between items-end">
                      <span className="text-xs uppercase tracking-widest font-black text-gray-400">Total del Pedido:</span>
                      <span className={`font-headline text-2xl font-bold leading-none ${isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'}`}>
                        ${totalCarrito.toLocaleString('es-CL')}
                      </span>
                    </div>

                    {/* Botón de Confirmación y Puntero de Cursor de la captura */}
                    {carrito.length > 0 ? (
                      <div className="relative group/checkout-btn">
                        <button
                          onClick={prepararCheckout}
                          className={`w-full py-4 rounded-2xl font-headline text-sm tracking-widest font-black uppercase shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2 cursor-pointer ${
                            isDark ? 'bg-[#e2bd6c] text-black shadow-[#e2bd6c]/10 hover:bg-[#ebd59f]' : 'bg-[#5d3a28] text-white shadow-[#5d3a28]/10 hover:bg-[#4a2e20]'
                          } ${tourStep === 5 ? 'ring-4 ring-primary animate-pulse' : ''}`}
                        >
                          Confirmar Pedido
                        </button>
                        
                        {/* Simulación del Puntero de Cursor e Indicador de Toque (como en la captura) */}
                        <div className="absolute -bottom-1 right-[15%] pointer-events-none select-none z-20 flex items-center justify-center">
                          {/* Toque Ripple de onda concéntrica */}
                          <div className="absolute w-12 h-12 bg-[#5d3a28]/15 dark:bg-white/20 border border-white/30 rounded-full animate-ping animate-duration-1000" />
                          <div className="absolute w-8 h-8 bg-white/25 border border-white/40 rounded-full animate-pulse" />
                          
                          {/* Cursor flecha blanca clásica */}
                          <svg className="w-5 h-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] text-white relative left-1 top-1.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4 2l16 12-7.5 2 4.5 7.5-3 1.5-4.5-7.5-5.5 5.5v-21z" stroke="black" strokeWidth="1" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <button
                        disabled
                        className="w-full py-4 rounded-2xl font-headline text-sm tracking-widest font-black uppercase bg-gray-500/10 text-gray-500 border border-dashed border-gray-500/20 cursor-not-allowed text-center"
                      >
                        Carrito Vacío
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
            </div>
            
          </div>
        </div>
      )}

      {/* MODAL SELECCIÓN DE VARIANTES */}
      {productParaAñadir && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setProductParaAñadir(null)} />
          <div className={`w-full max-w-sm rounded-[32px] sm:rounded-[32px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh] border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            <div className={`p-6 border-b shrink-0 flex justify-between items-center ${isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/10 bg-surface-container-low'}`}>
              <h3 className={`font-headline font-bold text-lg pr-4 ${isDark ? 'text-white' : 'text-on-surface'}`}>Selecciona una opción</h3>
              <button onClick={() => setProductParaAñadir(null)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-gray-400' : 'bg-surface-variant text-outline'}`}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar">
              <div className={`flex items-center gap-4 mb-4 pb-4 border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
                {productParaAñadir.fotoUrl && (
                  <img src={productParaAñadir.fotoUrl} alt={productParaAñadir.nombre} className={`w-16 h-16 rounded-xl object-cover border ${isDark ? 'bg-white/5 border-white/5' : 'bg-surface-variant border-outline-variant/20'}`} />
                )}
                <div>
                  <p className={`font-bold text-sm leading-tight mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>{productParaAñadir.nombre}</p>
                  <p className={`font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>${(productParaAñadir.precio || 0).toLocaleString('es-CL')}</p>
                </div>
              </div>

              {productParaAñadir.variantes.filter(v => Number(v.stock) > 0).map((v, i) => {
                // Checar si ya está en carrito para esta variante específica
                const idCartVariante = `${productParaAñadir.id}-${v.nombre}`;
                const inCart = carrito.find(item => item.idCart === idCartVariante);
                
                return (
                  <button
                    key={i}
                    onClick={() => setVarianteSeleccionada(v)}
                    className={`w-full flex justify-between items-center p-4 rounded-[20px] border-2 transition-all ${varianteSeleccionada === v ? (isDark ? 'border-[#e2bd6c] bg-[#e2bd6c]/5' : 'border-primary bg-primary/5') : (isDark ? 'border-white/10 bg-[#151515] hover:border-[#e2bd6c]/30' : 'border-outline-variant/10 bg-surface hover:border-primary/30')}`}
                  >
                    <span className={`font-bold text-sm uppercase flex items-center gap-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                      {v.nombre}
                      {inCart && <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/20 text-primary'}`}>{inCart.cantidad} en pedido</span>}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isDark ? 'text-[#e2bd6c] bg-[#e2bd6c]/10' : 'text-secondary bg-secondary/10'}`}>{v.stock} disp.</span>
                  </button>
                )
              })}
              
              {productParaAñadir.variantes.filter(v => Number(v.stock) > 0).length === 0 && (
                <p className={`text-center text-sm font-bold py-4 ${isDark ? 'text-red-400' : 'text-error'}`}>No hay stock disponible en ninguna variante.</p>
              )}
            </div>
            <div className={`p-6 border-t shrink-0 ${isDark ? 'bg-[#151515] border-white/5' : 'bg-surface-container border-outline-variant/10'}`}>
              <button 
                disabled={!varianteSeleccionada}
                onClick={(e) => {
                  animateFlyToCart(e, productParaAñadir.fotoUrl);
                  añadirAlCarrito(productParaAñadir, varianteSeleccionada);
                }}
                className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${varianteSeleccionada ? (isDark ? 'bg-[#e2bd6c] text-black shadow-lg hover:scale-[1.02]' : 'bg-primary text-on-primary shadow-lg hover:scale-[1.02]') : (isDark ? 'bg-white/5 text-gray-500 opacity-50 cursor-not-allowed' : 'bg-surface-variant text-outline opacity-50 cursor-not-allowed')}`}
              >
                Añadir al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE PRODUCTO */}
      {productoParaVer && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setProductoParaVer(null)} />
          
          <div 
            className={`w-full max-w-lg md:max-w-7xl rounded-[32px] md:rounded-[48px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col md:flex-row h-full max-h-[92vh] md:h-[90vh] overscroll-contain border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* BOTÓN CERRAR FLOTANTE PARA MÓVIL / ESCRITORIO */}
            <button 
              onClick={() => setProductoParaVer(null)} 
              className={`absolute top-4 right-4 z-[70] w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/10 hover:bg-black/20 text-on-surface'}`}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden custom-scrollbar">
              {/* COLUMNA IZQUIERDA: GALERÍA */}
              <div className={`w-full md:w-[60%] flex flex-col border-b md:border-b-0 md:border-r shrink-0 ${isDark ? 'bg-[#0c0c0c] border-white/5' : 'bg-white border-outline-variant/10'}`}>
                <div className={`flex-1 relative group/gallery overflow-hidden flex items-center justify-center p-6 md:p-12 ${isDark ? 'bg-[#0c0c0c]' : 'bg-[#fcfcfc]'}`}>
                  <div className={`absolute inset-4 md:inset-8 rounded-[48px] overflow-hidden z-0 backdrop-blur-sm shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] ${isDark ? 'bg-black/40' : 'bg-white/50'}`}>
                    {/* FONDO DIFUMINADO DINÁMICO */}
                    {fotosProducto[indexImagenActual] && (
                      <div className="absolute inset-0">
                        <img 
                          src={fotosProducto[indexImagenActual]} 
                          className="w-full h-full object-cover blur-3xl scale-150 opacity-40 transition-all duration-1000 ease-in-out" 
                          alt="Dynamic background"
                        />
                        <div className={`absolute inset-0 ${isDark ? 'bg-black/20' : 'bg-white/10'}`} />
                      </div>
                    )}
                  </div>

                  {fotosProducto[indexImagenActual] ? (
                    <div 
                      className={`relative z-10 max-w-full max-h-full transition-all duration-500 cursor-zoom-in active:scale-95 ${animacion}`}
                      onClick={() => setExpandedImage(fotosProducto[indexImagenActual])}
                    >
                      <img 
                        src={fotosProducto[indexImagenActual]} 
                        alt={productoParaVer.nombre} 
                        className={`max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-8 ${isDark ? 'border-[#1e1e1e]' : 'border-white'}`} 
                      />
                      <div className={`absolute inset-0 rounded-[40px] transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`} />
                    </div>
                  ) : (
                    <div className="relative z-10">
                      <span className={`material-symbols-outlined text-7xl ${isDark ? 'text-white/20' : 'text-outline/30'}`}>image</span>
                    </div>
                  )}

                  {/* FLECHAS INTERNAS */}
                  {fotosProducto.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); anteriorImagen(); }}
                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full transition-all opacity-0 group-hover/gallery:opacity-100 ${isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant hover:scale-110 shadow-xl'}`}
                      >
                        <span className="material-symbols-outlined text-2xl">chevron_left</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); siguienteImagen(); }}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full transition-all opacity-0 group-hover/gallery:opacity-100 ${isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant hover:scale-110 shadow-xl'}`}
                      >
                        <span className="material-symbols-outlined text-2xl">chevron_right</span>
                      </button>
                    </>
                  )}

                  {/* INDICADOR NUMÉRICO REFINADO (AUTO-OCULTABLE) */}
                  {fotosProducto.length > 1 && mostrarIndicador && (
                    <div className={`absolute bottom-10 right-10 z-20 flex items-center gap-2 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border md:hidden animate-in fade-in zoom-in duration-500 animate-out fade-out zoom-out ${isDark ? 'bg-[#1e1e1e]/90 border-white/5' : 'bg-white/90 border-outline-variant/10'}`}>
                      <span className={`material-symbols-outlined text-sm ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>imagesmode</span>
                      <span className={`text-[11px] font-black tracking-[0.1em] ${isDark ? 'text-white' : 'text-on-surface'}`}>
                        {indexImagenActual + 1} <span className="text-outline/40 mx-0.5">/</span> {fotosProducto.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* MINIATURAS EN ESCRITORIO */}
                {fotosProducto.length > 1 && (
                  <div className={`hidden md:flex gap-2 p-4 justify-center border-t overflow-x-auto ${isDark ? 'border-white/5' : 'border-outline-variant/5'}`}>
                    {fotosProducto.map((f, i) => (
                      <button 
                        key={i}
                        onClick={() => setIndexImagenActual(i)}
                        className={`w-20 h-20 rounded-2xl border-2 overflow-hidden transition-all shrink-0 p-1 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'} ${indexImagenActual === i ? (isDark ? 'border-[#e2bd6c] shadow-lg scale-110' : 'border-primary shadow-lg scale-110') : (isDark ? 'border-white/10 opacity-60 hover:opacity-100 hover:border-[#e2bd6c]/30' : 'border-outline-variant/10 opacity-60 hover:opacity-100 hover:border-primary/30')}`}
                      >
                        <img src={f} className="w-full h-full object-cover rounded-xl" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* COLUMNA DERECHA: INFO */}
              <div className={`w-full md:w-[40%] flex flex-col md:overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#121212]' : 'bg-surface-container-low'}`}>
                <div className="p-8 md:p-12 flex-1 space-y-10">
                  {/* CABECERA: NOMBRE Y MARCA CENTRALIZADA ABAJO */}
                  <div className="animate-in fade-in slide-in-from-right duration-500 delay-100 text-center">
                    <h2 className={`font-headline font-bold text-3xl md:text-5xl leading-[1.1] mb-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>{productoParaVer.nombre}</h2>
                    <p className={`text-xs md:text-sm font-medium uppercase tracking-[0.2em] opacity-60 mb-6 ${isDark ? 'text-[#e2bd6c]/60' : 'text-outline'}`}>{(productoParaVer.coleccion || 'SIN CATEGORÍA').toUpperCase()}</p>
                    
                    <div className="flex items-center gap-4 justify-center">
                      <div className={`h-[1px] flex-1 bg-gradient-to-r ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                      <p className={`text-xs md:text-sm font-bold uppercase tracking-[0.4em] px-2 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>{productoParaVer.marca || 'GENÉRICO'}</p>
                      <div className={`h-[1px] flex-1 bg-gradient-to-l ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                    </div>
                  </div>


                  {/* DESCRIPCIÓN REFINADA */}
                  <div className="space-y-5 animate-in fade-in slide-in-from-right duration-500 delay-300">
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined text-xl ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>description</span>
                      <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.3em] ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>Descripción Detallada</p>
                    </div>
                    
                    <div className="space-y-4">
                      {productoParaVer.descripcion ? (
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

                            const lineas = productoParaVer.descripcion.split('\n');
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
                                    <div className="flex items-center gap-2.5 mb-3">
                                      <span className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-[10px] md:text-xs font-black bg-[#e2bd6c]/15 text-[#e2bd6c] border border-[#e2bd6c]/30 rounded-full shrink-0 shadow-sm animate-pulse">
                                        {num}
                                      </span>
                                      <h4 className={`text-xs md:text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                        {renderContent(textTitle)}
                                      </h4>
                                    </div>
                                  );
                                } else {
                                  titleNode = (
                                    <div className="flex items-center gap-2 mb-3 border-l-2 border-[#e2bd6c] pl-2.5">
                                      <h4 className={`text-xs md:text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                        {renderContent(seccion.title)}
                                      </h4>
                                    </div>
                                  );
                                }
                              }

                              return (
                                <div
                                  key={idx}
                                  className={`backdrop-blur-sm p-5 md:p-6 rounded-[24px] border shadow-sm transition-all duration-300 hover:scale-[1.01] ${
                                    isDark
                                      ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
                                      : 'bg-black/[0.01] hover:bg-black/[0.03] border-outline-variant/10 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)]'
                                  }`}
                                >
                                  {titleNode}
                                  <div className="space-y-2 leading-relaxed">
                                    {seccion.contentLines.map((line, lIdx) => {
                                      const trimmedLine = line.trim();
                                      if (trimmedLine === '') return <div key={lIdx} className="h-2" />;
                                      
                                      const esViñeta = trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*');
                                      if (esViñeta) {
                                        const cleanLine = trimmedLine.replace(/^[•\-*]\s*/, '');
                                        return (
                                          <div key={lIdx} className="flex items-start gap-2 text-xs md:text-sm">
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
                                          <div key={lIdx} className="flex items-start gap-2.5 text-xs md:text-sm py-0.5 animate-fadeIn">
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
                                          className={`text-xs md:text-sm ${
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
                        <div className={`backdrop-blur-sm p-8 rounded-[24px] border shadow-inner text-center space-y-3 ${
                          isDark ? 'bg-white/5 border-white/5 text-white/30' : 'bg-white/50 border-outline-variant/10 text-outline/50'
                        }`}>
                          <span className="material-symbols-outlined text-3xl">info</span>
                          <p className="text-xs md:text-sm italic">
                            No hay una descripción detallada disponible para este producto en este momento.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STOCK CON DISEÑO DE TARJETA */}
                  <div className="animate-in fade-in slide-in-from-right duration-500 delay-400">
                    <div className={`backdrop-blur-sm p-6 md:p-10 rounded-[40px] border relative overflow-hidden group shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] ${isDark ? 'bg-white/0 border-white/5' : 'bg-gradient-to-br from-white to-[#f5f5f5] border-outline-variant/10'}`}>
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                        <span className={`material-symbols-outlined text-8xl transform rotate-12 ${isDark ? 'text-white' : 'text-primary'}`}>inventory_2</span>
                      </div>
                      <div className="flex items-center gap-6 relative z-10">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c]' : 'bg-secondary/5 text-secondary'}`}>
                          <span className="material-symbols-outlined text-4xl">inventory_2</span>
                        </div>
                        <div>
                          <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-2 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Disponibilidad en Bodega</p>
                          <p className={`text-xl md:text-3xl font-black ${isDark ? 'text-white' : 'text-on-surface'}`}>
                            {productoParaVer.variantes?.length > 0 
                              ? `${productoParaVer.variantes.reduce((sum, v) => sum + Number(v.stock), 0)} UNIDADES`
                              : `${productoParaVer.stock} UNIDADES`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BARRA DE ACCIÓN INFERIOR CON PRECIO Y BOTÓN */}
                <div className={`p-6 md:p-8 backdrop-blur-2xl border-t sticky bottom-0 z-20 animate-in fade-in slide-in-from-bottom duration-700 delay-500 ${isDark ? 'bg-[#121212]/90 border-white/5' : 'bg-white/90 border-outline-variant/10'}`}>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* PRECIO COMPACTO EN EL FOOTER */}
                    <div className="flex flex-col items-center md:items-start shrink-0">
                      <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Precio Internet</p>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-light ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>$</span>
                        <p className={`font-black text-4xl md:text-5xl tracking-tighter ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                          {(productoParaVer.precio || 0).toLocaleString('es-CL')}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={(e) => {
                        const hasVariants = productoParaVer.variantes && productoParaVer.variantes.length > 0;
                        if (!hasVariants) {
                          animateFlyToCart(e, productoParaVer.fotoUrl);
                        }
                        abrirModalAñadir(productoParaVer);
                        setProductoParaVer(null);
                      }}
                      className={`group relative flex-1 w-full py-5 md:py-7 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs md:text-sm shadow-xl overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all ${isDark ? 'bg-[#e2bd6c] text-black' : 'bg-primary text-on-primary'}`}
                    >
                      <div className={`absolute inset-0 w-1/2 h-full skew-x-[-25deg] -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out ${isDark ? 'bg-black/20' : 'bg-white/20'}`} />
                      <div className="relative flex justify-center items-center gap-4">
                        <span className="material-symbols-outlined text-2xl md:text-3xl group-hover:rotate-12 transition-transform">shopping_cart_checkout</span>
                        <span>Añadir al Pedido</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT WHATSAPP */}
      {showCheckout && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowCheckout(false)} />
          <div className={`w-full max-w-sm rounded-[32px] shadow-2xl relative z-10 p-8 text-center animate-in zoom-in-95 duration-300 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">chat</span>
            </div>
            <h3 className={`font-headline font-bold text-xl mb-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>Confirmar Pedido</h3>
            
            {currentUser ? (
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Enviaremos tu pedido a nuestro WhatsApp.<br/>
                <span className={`text-[10px] uppercase font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>Sesión iniciada como {currentUser.displayName}</span>
              </p>
            ) : (
              <div className="mb-6">
                <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>Ingresa tu nombre para enviar el detalle de tu pedido directamente por WhatsApp.</p>
                <button 
                  onClick={() => {setShowCheckout(false); setShowAuthModal(true);}} 
                  className={`text-xs font-bold hover:underline ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}
                >
                  ¿Tienes cuenta? Inicia sesión aquí
                </button>
              </div>
            )}
            
            <input 
              type="text"
              autoFocus
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Tu nombre y apellido..."
              className={`w-full border-2 px-5 py-4 rounded-2xl text-center font-bold outline-none transition-all mb-6 ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-[#e2bd6c]' : 'bg-surface-container-low border-primary/20 focus:border-primary text-primary'}`}
            />

            <div className="flex gap-3">
              <button 
                onClick={() => setShowCheckout(false)} 
                className={`flex-1 py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider transition-colors ${isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={enviarPedidoWhatsApp}
                className={`flex-[2] bg-[#25D366] text-white py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex justify-center items-center gap-2 ${tourStep === 6 ? 'ring-4 ring-[#25D366] animate-pulse shadow-[0_0_25px_rgba(37,211,102,0.9)] scale-105' : ''}`}
              >
                Enviar a WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
      {/* VISOR DE IMAGEN AMPLIADA (ZOOM) CON NAVEGACIÓN */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setExpandedImage(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* BOTÓN CERRAR */}
          <button className="absolute top-6 right-6 md:top-12 md:right-12 text-white/40 hover:text-white transition-colors z-[210] p-4">
            <span className="material-symbols-outlined text-5xl">close</span>
          </button>

          {/* FLECHAS DE NAVEGACIÓN EN ZOOM (AUTO-OCULTABLES) */}
          {fotosProducto.length > 1 && mostrarControlesZoom && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); anteriorImagen(); }}
                className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[210] backdrop-blur-md animate-in fade-in slide-in-from-left duration-300"
              >
                <span className="material-symbols-outlined text-4xl">chevron_left</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); siguienteImagen(); }}
                className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[210] backdrop-blur-md animate-in fade-in slide-in-from-right duration-300"
              >
                <span className="material-symbols-outlined text-4xl">chevron_right</span>
              </button>
            </>
          )}

          <div 
            className={`relative z-[205] max-w-full max-h-full transition-transform duration-500 ease-out ${animacion}`}
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              touchAction: 'none'
            }}
            onDoubleClick={() => scale > 1 ? resetZoom() : setScale(2.5)}
          >
            <img 
              src={fotosProducto[indexImagenActual]} 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl select-none pointer-events-none" 
              alt="Imagen ampliada"
            />
            {/* INDICADOR NUMÉRICO EN ZOOM (Solo si no hay zoom aplicado) */}
            {fotosProducto.length > 1 && scale === 1 && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-white/10 text-white/60 px-4 py-1.5 rounded-full text-xs font-black tracking-widest backdrop-blur-md border border-white/10">
                {indexImagenActual + 1} / {fotosProducto.length}
              </div>
            )}
          </div>

          {/* BOTÓN RESET ZOOM (Solo aparece si hay zoom) */}
          {scale > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); resetZoom(); }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-6 py-3 rounded-full font-bold shadow-2xl z-[220] flex items-center gap-2 animate-in slide-in-from-bottom"
            >
              <span className="material-symbols-outlined">zoom_out</span>
              <span>Resetear Zoom</span>
            </button>
          )}
        </div>
      )}

      {/* ── MODAL VIDEO TUTORIAL ── */}
      {showVideoModal && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-2 xs:p-4 py-8">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowVideoModal(false)} />
          
          {/* Elemento de audio real para reproducir la música de fondo */}
          <audio ref={audioRef} src="/music.mp3" loop />
          
          <div className={`relative w-full max-w-3xl border rounded-[2rem] sm:rounded-[2.5rem] p-4 xs:p-6 md:p-8 shadow-2xl overflow-hidden animate-in zoom-in duration-300 ${
            isDark ? 'bg-[#151515] border-white/10 text-white shadow-black/90' : 'bg-white border-outline-variant/20 text-on-surface shadow-black/20'
          }`}>
            
            {/* Brillos dorados de fondo en el modal */}
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#e2bd6c]/10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

            {/* Header del modal */}
            <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'}`}>
                  <span className="material-symbols-outlined font-bold">smart_display</span>
                </div>
                <div>
                  <h2 className="font-headline text-base xs:text-lg md:text-xl font-bold">Video Tutorial de Compra</h2>
                  <p className={`text-[10px] md:text-xs font-medium ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    Aprende en 1 minuto cómo realizar tus pedidos en la plataforma Leis
                  </p>
                </div>
              </div>
              
              <button 
                onClick={() => setShowVideoModal(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-surface-variant text-outline hover:text-on-surface'
                }`}
                title="Cerrar"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Custom Interactive HTML5 Video Tutorial Simulator */}
            <div 
              ref={simulatorRef}
              className={`relative overflow-hidden border border-[#e2bd6c]/20 dark:border-white/5 bg-[#0f0f12] select-none group transition-all duration-300 ${
                isFullscreen 
                  ? 'w-full h-full rounded-none p-4 sm:p-8' 
                  : 'h-[350px] xs:h-[370px] sm:h-auto sm:aspect-video rounded-3xl mb-5 shadow-2xl'
              }`}
            >
              
              {/* Contenido Dinámico de las Diapositivas */}
              <div className="absolute inset-0 flex items-center justify-center p-3 xs:p-4 sm:p-6 transition-all duration-700 overflow-hidden">
                
                {/* Fondo Degradado Dinámico según Diapositiva */}
                <div className="absolute inset-0 opacity-10 blur-xl scale-110 pointer-events-none transition-all duration-1000"
                  style={{
                    backgroundImage: `radial-gradient(circle at 50% 50%, ${
                      activeSlide === 0 ? 'rgba(226,189,108,0.2) 0%, rgba(15,15,18,1) 80%' :
                      activeSlide === 1 ? 'rgba(59,130,246,0.2) 0%, rgba(15,15,18,1) 80%' :
                      activeSlide === 2 ? 'rgba(236,72,153,0.2) 0%, rgba(15,15,18,1) 80%' :
                      activeSlide === 3 ? 'rgba(245,158,11,0.2) 0%, rgba(15,15,18,1) 80%' :
                      'rgba(16,185,129,0.2) 0%, rgba(15,15,18,1) 80%'
                    })`
                  }}
                />

                {/* Unified Mockup Contenedor Centrado (Sin Cabecera de Mac) */}
                <div className="w-full max-w-xl xs:max-w-2xl sm:max-w-[90%] md:max-w-[95%] aspect-[1024/556] max-h-[85%] bg-black/40 border border-white/10 rounded-2xl overflow-hidden shrink-0 shadow-2xl relative select-none animate-in zoom-in duration-300">
                  
                  {/* Browser Viewport Area (Ocupa el 100% de la maqueta) */}
                  <div className="relative w-full h-full bg-[#0f0f12] overflow-hidden">

                    {/* Cinematic Pan-and-Zoom Camera Wrapper */}
                    <div 
                      className="w-full h-full relative"
                      style={{
                        transform: `scale(${camera.scale}) translate(${camera.xShift}%, ${camera.yShift}%)`,
                        transformOrigin: '50% 50%',
                        transition: 'transform 100ms linear'
                      }}
                    >
                      {/* Global Golden Luxury Border Frame (Leis Elegant Design with Shines and Rounded Corners) */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#f8ecd2] via-[#e2bd6c] to-[#be9440] p-1.5 rounded-[2rem] border border-[#e2bd6c]/50 shadow-[0_20px_50px_rgba(226,189,108,0.3)] overflow-hidden flex items-center justify-center">
                        
                        {/* Glow Orbs & Sparkles (Brillos) inside the frame border */}
                        <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-white/40 blur-2xl pointer-events-none animate-pulse" />
                        <div className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full bg-white/30 blur-2xl pointer-events-none animate-pulse" />
                        
                        <span className="absolute top-2 left-6 text-xs sm:text-sm animate-pulse text-white select-none pointer-events-none z-10">✨</span>
                        <span className="absolute top-8 right-12 text-[10px] animate-ping duration-[3.5s] text-white select-none pointer-events-none z-10">✨</span>
                        <span className="absolute bottom-6 left-12 text-xs animate-bounce text-white select-none pointer-events-none z-10">✨</span>
                        <span className="absolute bottom-2 right-6 text-sm animate-pulse text-white select-none pointer-events-none z-10">✨</span>

                        {/* Inner Viewport Container with Light Leis Brand Design and Floating Glow Particles */}
                        <div className="w-full h-full relative rounded-[1.7rem] overflow-hidden bg-gradient-to-br from-[#fdfaf5] via-[#f7f0e3] to-[#ebdcb9] flex items-center justify-center p-2.5 sm:p-4 select-none">
                          
                          {/* Ambient soft glow spots on the light background */}
                          <div className="absolute top-1/4 left-1/4 w-36 h-36 rounded-full bg-[#e2bd6c]/20 blur-3xl pointer-events-none" />
                          <div className="absolute bottom-1/4 right-1/4 w-36 h-36 rounded-full bg-[#f8ecd2]/40 blur-3xl pointer-events-none" />
                          
                          {/* Floating Luxury Gold Shines and Sparkles (Brillos y Estrellas flotantes en el fondo claro) */}
                          <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
                            <span className="absolute top-[8%] left-[6%] text-xs opacity-60 animate-pulse text-[#8e6d3c]">✨</span>
                            <span className="absolute top-[12%] right-[8%] text-[10px] opacity-40 animate-ping duration-[4s] text-[#8e6d3c]">✨</span>
                            <span className="absolute bottom-[12%] left-[10%] text-xs opacity-50 animate-bounce text-[#8e6d3c]">✨</span>
                            <span className="absolute bottom-[10%] right-[6%] text-sm opacity-60 animate-pulse text-[#8e6d3c]">✨</span>
                          </div>

                          {/* Floating Glassmorphic App Window Card (Rounded corners, golden border glow, elegant drop shadow) */}
                          <div className="w-[93%] h-[93%] relative rounded-2xl overflow-hidden bg-[#0f0f12] border border-[#e2bd6c]/40 shadow-[0_15px_40px_rgba(142,109,60,0.35),0_4px_10px_rgba(0,0,0,0.4)] flex items-center justify-center transition-all duration-300">
                            
                            {/* Premium Glow Shine Sweep Effect (Efecto brillo de luz que cruza la pantalla) */}
                            <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                              <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-25deg] animate-[shine_8s_infinite]" />
                              <style>{`
                                @keyframes shine {
                                  0% { left: -100%; }
                                  20% { left: 100%; }
                                  100% { left: 100%; }
                                }
                              `}</style>
                            </div>
                          
                          {/* Slide 0 Screen: Welcome overlay */}
                          {activeSlide === 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-500">
                              {/* Blurred catalog background image */}
                              <div className="absolute inset-0 opacity-20 blur-[1px] pointer-events-none -z-10">
                                <img src="/tutorial_step3.png" className="w-full h-full object-fill" alt="Fondo Leis" />
                              </div>
                              
                              <div className="w-10 h-10 sm:w-16 sm:h-16 flex items-center justify-center bg-white/5 border border-white/10 rounded-full shadow-inner relative animate-pulse mb-3">
                                <span className="text-xl sm:text-4xl">👑</span>
                                <span className="absolute bottom-0 right-0 text-[8px] sm:text-xs animate-spin duration-[6s]">✨</span>
                              </div>
                              
                              <span className="inline-block px-2 py-0.5 rounded-full text-[6px] sm:text-[8px] font-bold tracking-widest uppercase bg-[#e2bd6c]/10 text-[#e2bd6c] border border-[#e2bd6c]/20 mb-1 sm:mb-2 animate-pulse">
                                Introducción
                              </span>
                              <h3 className="font-headline text-[10px] sm:text-base md:text-lg font-black text-white leading-tight">
                                Bienvenido al <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e2bd6c] to-[#f3d99d]">Catálogo Leis</span> ✨
                              </h3>
                              <p className="text-[7px] sm:text-[9px] text-gray-300 mt-1 max-w-[80%] leading-relaxed font-semibold">
                                Te guiaremos paso a paso para explorar productos, usar filtros, añadir al carrito y enviar tu pedido a nuestro WhatsApp de forma 100% clara y profesional. ¡Comencemos!
                              </p>
                            </div>
                          )}
                          
                          {/* Slide 1 Screen: Explorar filtros */}
                          {activeSlide === 1 && (
                            <div className="absolute inset-0 animate-in fade-in duration-500">
                              <img src="/tutorial_step2.png" className="w-full h-full object-fill" alt="Explorar filtros" />
                              
                              {/* Search bar highlights */}
                              <GlowingHighlight className="text-[#e2bd6c]" style={{ left: '2.2%', top: '17.5%', width: '13.5%', height: '4.5%' }} />
                              <FloatingArrow className="text-[#e2bd6c]" style={{ left: '8%', top: '25%' }} direction="up" />
                              
                              {/* Target Product Card highlights */}
                              <GlowingHighlight className="text-[#e2bd6c]" style={{ left: '79.5%', top: '15.0%', width: '18.5%', height: '50.0%' }} />
                              <FloatingArrow className="text-[#e2bd6c]" style={{ left: '75%', top: '35%' }} direction="right" />

                              {/* Typing Search overlay */}
                              <div className="absolute font-sans text-[4.5px] sm:text-[6.5px] font-bold text-white/95 select-none flex items-center" style={{ left: '3.0%', top: '18.0%', width: '11%', height: '3.5%', paddingLeft: '4px' }}>
                                {simulatedSearchVal}
                                {activeSlide === 1 && (videoCurrentTime - 5) >= 1.5 && (videoCurrentTime - 5) < 3.0 && Math.floor(videoCurrentTime * 3) % 2 === 0 && (
                                  <span className="w-[1px] h-[65%] bg-[#e2bd6c] ml-0.5" />
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Slide 2 Screen: Agregar al carrito */}
                          {activeSlide === 2 && (
                            <div className="absolute inset-0 animate-in fade-in duration-500">
                              <img src="/tutorial_step3.png" className="w-full h-full object-fill" alt="Agregar al carrito" />
                              
                              {/* Add to cart button highlight */}
                              <PulsingRing className="text-[#e2bd6c]" style={{ left: '86.0%', top: '90.0%', width: '16px', height: '16px' }} />
                              <FloatingArrow className="text-[#e2bd6c]" style={{ left: '86.0%', top: '78.0%' }} direction="down" />
                              
                              {/* Floating cart badge highlight in header */}
                              <PulsingRing className="text-[#e2bd6c]" style={{ left: '96.5%', top: '6.0%', width: '12px', height: '12px' }} />
                              <FloatingArrow className="text-[#e2bd6c]" style={{ left: '96.5%', top: '15.0%' }} direction="up" />
                            </div>
                          )}
                          
                          {/* Slide 3 Screen: Abrir carrito */}
                          {activeSlide === 3 && (
                            <div className="absolute inset-0 animate-in fade-in duration-500">
                              {/* Before click: show detail modal. After click: show full screen cart drawer screenshot */}
                              {(videoCurrentTime - 15) < 1.2 ? (
                                <img src="/tutorial_step3.png" className="w-full h-full object-fill blur-[0.5px]" alt="Abrir pedido" />
                              ) : (
                                <img src="/tutorial_step4.png" className="w-full h-full object-fill animate-in fade-in duration-300" alt="Carrito de compras" />
                              )}
                              
                              {/* Pulsing indicator on Hacer Pedido yellow button - absolute coordinate on full screenshot! */}
                              {(videoCurrentTime - 15) >= 1.2 && (
                                <>
                                  <PulsingRing className="text-[#e2bd6c]" style={{ left: '85.5%', top: '94.5%', width: '16px', height: '16px' }} />
                                  <FloatingArrow className="text-[#e2bd6c]" style={{ left: '85.5%', top: '83.0%' }} direction="down" />
                                </>
                              )}
                            </div>
                          )}
                          
                          {/* Slide 4 Screen: Enviar WhatsApp */}
                          {activeSlide === 4 && (
                            <div className="absolute inset-0 animate-in fade-in duration-500">
                              <img src="/tutorial_step3.png" className="w-full h-full object-fill blur-[1.5px]" alt="Enviar WhatsApp" />
                              
                              {/* Simulated modal popup container */}
                              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                <div className="w-[45%] aspect-[577/533] bg-[#151515] border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in zoom-in duration-300 relative">
                                  <img src="/tutorial_step1.png" className="w-full h-full object-fill" alt="Confirmar pedido" />
                                  
                                  {/* Typing Name overlay */}
                                  <div className="absolute font-sans text-[4.5px] sm:text-[6.5px] font-semibold text-white/80 select-none flex items-center" style={{ left: '19.5%', top: '64.5%', width: '61%', height: '7%', paddingLeft: '6px' }}>
                                    {simulatedNameVal}
                                    {activeSlide === 4 && (videoCurrentTime - 20) >= 1.2 && (videoCurrentTime - 20) < 3.5 && Math.floor(videoCurrentTime * 3) % 2 === 0 && (
                                      <span className="w-[1px] h-[65%] bg-emerald-400 ml-0.5 animate-pulse" />
                                    )}
                                  </div>

                                  {/* Pulsing indicator on Enviar a WhatsApp green button */}
                                  <PulsingRing className="text-emerald-400" style={{ left: '64.5%', top: '85.5%', width: '16px', height: '16px' }} />
                                  <FloatingArrow className="text-emerald-400" style={{ left: '64.5%', top: '75.0%' }} direction="down" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Floating Header Cart Count Badge overlay (Slides 2 & 3) */}
                          {simulatedCartCountVal > 0 && (activeSlide === 2 || activeSlide === 3) && (
                            <div className="absolute z-40 bg-[#e2bd6c] text-[#0f0f12] rounded-full font-black text-[5px] sm:text-[6px] flex items-center justify-center scale-100 animate-in zoom-in duration-300"
                                 style={{ left: '97.2%', top: '4.8%', width: '8px', height: '8px' }}>
                              {simulatedCartCountVal}
                            </div>
                          )}

                          {/* Flying Pink Dot (Slide 2) */}
                          {showFlyingDot && (
                            <div 
                              className="absolute z-50 w-2 h-2 -ml-1 -mt-1 rounded-full bg-[#e2bd6c] shadow-[0_0_8px_#e2bd6c] pointer-events-none"
                              style={{ left: `${dotX}%`, top: `${dotY}%` }}
                            />
                          )}

                          {/* Emerald Success Screen overlay (Slide 4) */}
                          {simulatedSuccessOpen && activeSlide === 4 && (
                            <div className="absolute inset-0 bg-[#0f0f12]/95 backdrop-blur-sm z-[80] flex flex-col items-center justify-center text-center p-3 animate-in fade-in duration-500">
                              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2 animate-bounce">
                                <span className="material-symbols-outlined text-emerald-400 text-lg sm:text-2xl font-black">check_circle</span>
                              </div>
                              <h4 className="font-headline text-[8px] sm:text-xs font-bold text-white tracking-widest uppercase">¡Pedido Enviado! 📲</h4>
                              <p className="text-[6px] sm:text-[9px] text-gray-400 mt-1 max-w-[80%] leading-relaxed">
                                Abriendo chat de WhatsApp Leis con los detalles formateados de tu pedido. ¡Gracias por tu compra!
                              </p>
                              <span className="mt-2.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[5px] sm:text-[7px] font-bold text-emerald-400 tracking-wider uppercase font-mono">
                                Estado: Listo
                              </span>
                            </div>
                          )}

                          {/* Simulated Custom Cursor Pointer & Ripples */}
                          {cursor.opacity > 0 && (
                            <>
                              {/* Click ripple circle */}
                              {cursor.isClicking && (
                                <div 
                                  className="absolute z-[85] w-6 h-6 rounded-full bg-[#e2bd6c]/30 border border-[#e2bd6c]/50 animate-ping pointer-events-none animate-duration-300"
                                  style={{ 
                                    left: `${cursor.x}%`, 
                                    top: `${cursor.y}%`,
                                    transform: 'translate(-50%, -50%)'
                                  }}
                                />
                              )}
                              {/* Cursor arrow pointer */}
                              <div 
                                className="absolute pointer-events-none z-[90] transition-all duration-75 flex flex-col items-start"
                                style={{ 
                                  left: `${cursor.x}%`, 
                                  top: `${cursor.y}%`,
                                  transform: 'translate(-1px, -1px) rotate(300deg)',
                                  opacity: cursor.opacity
                                }}
                              >
                                <span className="material-symbols-outlined text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-[11px] sm:text-[14px] font-bold select-none">
                                  navigation
                                </span>
                              </div>
                            </>
                          )}

                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Watermark de Marca */}
              <div className={`absolute z-20 flex items-center gap-2 pointer-events-none transition-opacity ${
                isFullscreen 
                  ? 'top-4 left-4 opacity-80' 
                  : 'top-3 left-3 sm:top-4 sm:left-4 opacity-40 group-hover:opacity-80'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#e2bd6c]" />
                <span className="text-[7px] sm:text-[8px] font-bold tracking-widest text-[#e2bd6c] uppercase font-headline">Leis Catalog Tutorial</span>
              </div>

              {/* Controles del Video Player Simulados */}
              <div className={`absolute bottom-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex flex-col gap-1.5 sm:gap-2 transition-transform ${
                isFullscreen 
                  ? 'translate-y-0' 
                  : 'translate-y-0 sm:translate-y-2 sm:group-hover:translate-y-0'
              }`}>
                
                {/* Línea de Tiempo / Progress Bar */}
                <div 
                  className="w-full py-1.5 cursor-pointer relative group/timeline"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const width = rect.width;
                    const newPct = clickX / width;
                    setVideoCurrentTime(Number((newPct * videoDuration).toFixed(1)));
                  }}
                >
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#e2bd6c] to-primary transition-all duration-75"
                      style={{ width: `${(videoCurrentTime / videoDuration) * 100}%` }}
                    />
                    <div 
                      className="absolute h-2.5 w-2.5 rounded-full bg-white border border-[#e2bd6c] -top-[3px] -ml-1 opacity-0 sm:group-hover/timeline:opacity-100 transition-opacity pointer-events-none"
                      style={{ left: `${(videoCurrentTime / videoDuration) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Fila de Botones del Reproductor */}
                <div className="flex items-center justify-between text-white text-xs">
                  
                  {/* Controles de la izquierda (Play, Pause, Tiempo) */}
                  <div className="flex items-center gap-2 sm:gap-4">
                    <button 
                      onClick={() => setVideoIsPlaying(!videoIsPlaying)}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-white border-0"
                      title={videoIsPlaying ? 'Pausar' : 'Reproducir'}
                    >
                      <span className="material-symbols-outlined text-base sm:text-lg">
                        {videoIsPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </button>

                    <button 
                      onClick={() => {
                        setVideoCurrentTime(0);
                        setVideoIsPlaying(true);
                      }}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-white border-0"
                      title="Reiniciar"
                    >
                      <span className="material-symbols-outlined text-xs sm:text-sm">replay</span>
                    </button>

                    {/* Tiempo Transcurrido */}
                    <span className="text-[9px] sm:text-[10px] font-mono text-gray-300">
                      {formatVideoTime(videoCurrentTime)} / {formatVideoTime(videoDuration)}
                    </span>
                  </div>

                  {/* Leyenda de la Diapositiva Activa */}
                  <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-black text-[#e2bd6c] hidden xs:inline-block bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 px-2 py-0.5 rounded">
                    {activeSlide === 0 ? 'Intro' : activeSlide === 1 ? 'Paso 1: Explorar' : activeSlide === 2 ? 'Paso 2: Comprar' : activeSlide === 3 ? 'Paso 3: Enviar' : 'Listo'}
                  </span>

                  {/* Controles de la derecha (Silenciar, Pantalla Completa) */}
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button 
                      onClick={() => setVideoIsMuted(!videoIsMuted)}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-white border-0"
                      title={videoIsMuted ? 'Activar Sonido' : 'Silenciar'}
                    >
                      <span className="material-symbols-outlined text-sm sm:text-base">
                        {videoIsMuted ? 'volume_off' : 'volume_up'}
                      </span>
                    </button>
                    
                    <span className="text-[8px] text-gray-400 font-semibold tracking-wider bg-white/5 px-2 py-0.5 rounded hidden sm:inline-block">
                      {videoIsMuted ? 'Silenciado' : 'Música'}
                    </span>

                    <button 
                      onClick={toggleFullscreen}
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-white border-0"
                      title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
                    >
                      <span className="material-symbols-outlined text-sm sm:text-base">
                        {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                      </span>
                    </button>
                  </div>

                </div>

              </div>

            </div>

            {/* Footer informativo modal */}
            <div className={`flex items-center gap-4 p-4 rounded-2xl border relative z-10 ${
              isDark ? 'bg-white/5 border-white/5' : 'bg-surface-container-low border-outline-variant/10'
            }`}>
              <span className="text-2xl shrink-0">✨</span>
              <p className={`text-[10px] md:text-xs leading-relaxed font-semibold ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                <strong className={isDark ? 'text-[#e2bd6c]' : 'text-primary'}>Guía Leis:</strong> "Bienvenido al video explicativo interactivo del catálogo de Leis. Hemos preparado este simulador paso a paso para enseñarte cómo explorar categorías, buscar productos, agregarlos al carrito y enviar tu pedido a nuestro WhatsApp de forma 100% clara y profesional. ¡Disfrútalo!"
              </p>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE AUTENTICACIÓN */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            {/* Header del Modal */}
            <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <h3 className={`font-headline text-2xl font-black italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                {authTab === 'login' ? 'Iniciar Sesión' : authTab === 'register' ? 'Crear Cuenta' : 'Recuperar Contraseña'}
              </h3>
              <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                {authTab === 'login' ? 'Bienvenido de vuelta' : authTab === 'register' ? 'Únete a nosotros' : 'Restablece tus credenciales'}
              </p>
              <button 
                onClick={() => setShowAuthModal(false)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {authTab !== 'forgot' ? (
              <>
                {/* Pestañas */}
                <div className={`flex border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
                  <button
                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${authTab === 'login' ? (isDark ? 'text-[#e2bd6c] border-b-2 border-[#e2bd6c]' : 'text-primary border-b-2 border-primary') : (isDark ? 'text-gray-400 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/30')}`}
                    onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); }}
                  >
                    Ingresar
                  </button>
                  <button
                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${authTab === 'register' ? (isDark ? 'text-[#e2bd6c] border-b-2 border-[#e2bd6c]' : 'text-primary border-b-2 border-primary') : (isDark ? 'text-gray-400 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/30')}`}
                    onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess(''); }}
                  >
                    Registrarse
                  </button>
                </div>

                {/* Formulario de Login/Registro */}
                <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
                  {authTab === 'register' && (
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Nombre Completo</label>
                      <input 
                        type="text" 
                        value={authForm.nombre}
                        onChange={e => setAuthForm({...authForm, nombre: e.target.value})}
                        required
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                        placeholder="Ej. Juan Pérez"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Correo Electrónico</label>
                    <input 
                      type="email" 
                      value={authForm.email}
                      onChange={e => setAuthForm({...authForm, email: e.target.value})}
                      required
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                      placeholder="tu@correo.com"
                    />
                  </div>

                  {authTab === 'register' && (
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Número de WhatsApp</label>
                      <input 
                        type="tel" 
                        value={authForm.whatsapp}
                        onChange={e => setAuthForm({...authForm, whatsapp: e.target.value})}
                        required
                        className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                        placeholder="+56 9 1234 5678"
                      />
                      <p className={`text-[10px] mt-1 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Se usará para autocompletar tus pedidos.</p>
                    </div>
                  )}

                  <div>
                    <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Contraseña</label>
                    <input 
                      type="password" 
                      value={authForm.password}
                      onChange={e => setAuthForm({...authForm, password: e.target.value})}
                      required
                      minLength={6}
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                      placeholder="••••••"
                    />
                    {authTab === 'login' && (
                      <div className="text-right mt-1.5">
                        <button 
                          type="button"
                          onClick={() => { setAuthTab('forgot'); setAuthError(''); setAuthSuccess(''); setResetEmailSuccess(''); setResetEmailError(''); }}
                          className={`text-[10px] font-extrabold uppercase tracking-wider transition-colors ${isDark ? 'text-gray-400 hover:text-[#e2bd6c]' : 'text-outline hover:text-primary'}`}
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                    )}
                  </div>

                  {authError && (
                    <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-xs font-bold text-center border border-error/20">
                      {authError}
                    </div>
                  )}

                  {authSuccess && (
                    <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl text-xs font-bold text-center border border-green-500/20 animate-in fade-in">
                      {authSuccess}
                    </div>
                  )}

                  <div className="pt-2">
                    <button 
                      type="submit"
                      disabled={isAuthLoading}
                      className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                    >
                      {isAuthLoading ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        authTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button 
                      type="button"
                      onClick={() => setShowAuthModal(false)}
                      className={`text-xs font-bold uppercase tracking-wider transition-colors ${isDark ? 'text-gray-400 hover:text-[#e2bd6c]' : 'text-outline hover:text-on-surface'}`}
                    >
                      Continuar como invitado
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Formulario de Recuperación de Contraseña */
              <form onSubmit={handleSendResetEmailForgot} className="p-6 space-y-4">
                <div className={`p-4 rounded-2xl flex gap-3 items-start ${isDark ? 'bg-white/5 border border-white/10' : 'bg-surface-container border border-outline-variant/30'}`}>
                  <span className={`material-symbols-outlined shrink-0 mt-0.5 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>mail</span>
                  <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                    Ingresa tu correo electrónico a continuación. Si la cuenta existe, te enviaremos un enlace seguro para restablecer tu contraseña.
                  </p>
                </div>

                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                    placeholder="tu@correo.com"
                  />
                </div>

                {resetEmailError && (
                  <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-xs font-bold text-center border border-error/20">
                    {resetEmailError}
                  </div>
                )}

                {resetEmailSuccess && (
                  <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl text-xs font-bold text-center border border-green-500/20 animate-in fade-in">
                    {resetEmailSuccess}
                  </div>
                )}

                <div className="pt-2 space-y-3">
                  <button 
                    type="submit"
                    disabled={isResetEmailLoading}
                    className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                  >
                    {isResetEmailLoading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      'Enviar Enlace'
                    )}
                  </button>

                  <button 
                    type="button"
                    onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); setResetEmailSuccess(''); setResetEmailError(''); }}
                    className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border ${isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'}`}
                  >
                    Volver a Iniciar Sesión
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE EDITAR PERFIL */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            
            {/* Header */}
            <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <h3 className={`font-headline text-2xl font-black italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                Editar Perfil
              </h3>
              <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Mantén tus datos actualizados
              </p>
              <button 
                onClick={() => setShowEditProfileModal(false)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              {editProfileError && (
                <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{editProfileError}</span>
                </div>
              )}

              {editProfileSuccess && (
                <div className="p-4 bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 text-[#e2bd6c] text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{editProfileSuccess}</span>
                </div>
              )}

              {/* Nombre completo */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
                  Nombre Completo
                </label>
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    person
                  </span>
                  <input 
                    type="text"
                    required
                    placeholder="Tu nombre completo"
                    value={editProfileForm.nombre}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, nombre: e.target.value })}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2bd6c]/50 transition-all border ${isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'}`}
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
                  Número de WhatsApp
                </label>
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    phone
                  </span>
                  <input 
                    type="tel"
                    required
                    placeholder="Ej: 56912345678"
                    value={editProfileForm.whatsapp}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, whatsapp: e.target.value })}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2bd6c]/50 transition-all border ${isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'}`}
                  />
                </div>
                <span className={`text-[9px] block ml-1 ${isDark ? 'text-gray-500' : 'text-outline'}`}>
                  Formato internacional sin el símbolo "+" (ej: 56912345678).
                </span>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors border ${isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'}`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isEditProfileLoading}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                >
                  {isEditProfileLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>

              {/* Sección Peligro: Eliminar Cuenta */}
              <div className={`pt-4 border-t flex flex-col items-center ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
                <button 
                  type="button"
                  onClick={() => {
                    setDeletePassword('')
                    setDeleteAccountError('')
                    setDeleteAccountSuccess('')
                    setShowDeleteAccountModal(true)
                    setShowEditProfileModal(false)
                  }}
                  className="text-error hover:underline text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 py-2 px-4 rounded-xl hover:bg-error/10 transition-all duration-300"
                >
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  Eliminar Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ELIMINAR CUENTA */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            
            {/* Header */}
            <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <h3 className="font-headline text-2xl font-black italic text-error">
                Eliminar Cuenta
              </h3>
              <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Esta acción es irreversible
              </p>
              <button 
                onClick={() => setShowDeleteAccountModal(false)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleDeleteAccount} className="p-6 space-y-4">
              <div className="p-4 bg-error/5 border border-error/20 rounded-2xl flex gap-3 items-start">
                <span className="material-symbols-outlined text-error shrink-0 mt-0.5">warning</span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-error">Advertencia de Seguridad</p>
                  <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                    Al eliminar tu cuenta, todos tus datos de perfil, historial de carrito y acceso serán borrados de forma permanente.
                  </p>
                </div>
              </div>

              {deleteAccountError && (
                <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{deleteAccountError}</span>
                </div>
              )}

              {deleteAccountSuccess && (
                <div className="p-4 bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 text-[#e2bd6c] text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{deleteAccountSuccess}</span>
                </div>
              )}

              {/* Confirmación con Contraseña */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
                  Contraseña Actual
                </label>
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    lock
                  </span>
                  <input 
                    type="password"
                    required
                    placeholder="Introduce tu contraseña para confirmar"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-error/50 transition-all border ${isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'}`}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowDeleteAccountModal(false)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors border ${isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'}`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isDeleteAccountLoading}
                  className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center bg-error text-on-error hover:bg-error-container/80"
                >
                  {isDeleteAccountLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Eliminar permanentemente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RESTABLECER CONTRASEÑA */}
      {showResetPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            
            {/* Header */}
            <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <h3 className={`font-headline text-2xl font-black italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                Restablecer Contraseña
              </h3>
              <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Enviar enlace de recuperación
              </p>
              <button 
                onClick={() => setShowResetPasswordModal(false)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-2xl flex gap-3 items-start ${isDark ? 'bg-white/5 border border-white/10' : 'bg-surface-container border border-outline-variant/30'}`}>
                <span className={`material-symbols-outlined shrink-0 mt-0.5 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>info</span>
                <div className="space-y-1">
                  <p className={`text-xs font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>Verificación de Correo</p>
                  <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                    Se enviará un correo con un enlace seguro para restablecer tu contraseña a tu dirección registrada:
                  </p>
                  <p className={`text-xs font-black truncate mt-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                    {currentUser?.email}
                  </p>
                </div>
              </div>

              {resetEmailError && (
                <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{resetEmailError}</span>
                </div>
              )}

              {resetEmailSuccess && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{resetEmailSuccess}</span>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowResetPasswordModal(false)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors border ${isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'}`}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSendResetEmailLoggedIn}
                  disabled={isResetEmailLoading}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                >
                  {isResetEmailLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Enviar Correo'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE ONBOARDING MASCOT (LA GATITA YOSHITA) ── */}
      {tourStep > 0 && (
        <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3 pointer-events-none max-w-[280px] md:max-w-sm">
          
          {isDialogMinimized ? (
            <button 
              onClick={() => setIsDialogMinimized(false)}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg text-[10px] font-black uppercase tracking-wider animate-bounce transition-all hover:scale-105 active:scale-95 ${
                isDark 
                  ? 'bg-[#e2bd6c] text-black border-[#e2bd6c] shadow-[#e2bd6c]/20' 
                  : 'bg-primary text-white border-primary shadow-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              Mostrar Guía 🐾
            </button>
          ) : (
            /* Globo de diálogo / Speech Bubble */
            <div className={`pointer-events-auto p-5 rounded-[2rem] border shadow-2xl relative animate-in slide-in-from-bottom-5 duration-500 ${isDark ? 'bg-[#151515] border-white/10 text-white shadow-black/80' : 'bg-white border-outline-variant/30 text-on-surface shadow-black/10'}`}>
              {/* Pequeño indicador del triángulo del globo */}
              <div className={`absolute bottom-[-8px] right-8 w-4 h-4 rotate-45 border-r border-b ${isDark ? 'bg-[#151515] border-white/10' : 'bg-white border-outline-variant/30'}`} />
              
              <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-outline-variant/10">
                <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
                  Guía Yoshita 🐾
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsDialogMinimized(true)}
                    className={`text-[10px] font-bold flex items-center gap-1 hover:underline ${isDark ? 'text-gray-400 hover:text-white' : 'text-outline hover:text-on-surface'}`}
                    title="Ocultar globo de texto"
                  >
                    <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                    Ocultar
                  </button>
                  <span className="opacity-30">|</span>
                  <button 
                    onClick={() => setTourStep(0)}
                    className={`text-[10px] font-bold hover:underline ${isDark ? 'text-gray-400 hover:text-white' : 'text-outline hover:text-on-surface'}`}
                  >
                    Salir
                  </button>
                </div>
              </div>

              <p className="text-[11px] md:text-xs leading-relaxed font-semibold">
                {tourStep === 1 && "🐾 ¡Hola! Miau~ Soy Yoshita 🐾 y te guiaré en este tutorial interactivo para realizar tu pedido. ¡Es súper fácil y rápido! Haz clic en Siguiente para empezar."}
                {tourStep === 2 && "🔍 ¡Paso 2! Aquí a la izquierda tienes la barra de búsqueda y filtros. Puedes escribir nombres (ej. 'Aceite') o filtrar por categoría. También, arriba a la derecha puedes pulsar el icono de usuario 👤 para crear una cuenta o iniciar sesión y guardar tus datos automáticamente."}
                {tourStep === 3 && "🛒 ¡Paso 3! Miau~ Ahora busquemos tu producto favorito (como el 'Aceite Collagen' de abajo) y haz clic en su botón Añadir al Carrito 🛒 para agregarlo."}
                {tourStep === 4 && "🛍️ ¡Paso 4! ¡Miau-tástico! Ya tienes el producto en tu bolso. Ahora, mira arriba a la derecha y haz clic en el botón del Carrito de Compras 🛒."}
                {tourStep === 5 && "📋 ¡Paso 5! Revisa que las cantidades y productos estén perfectos en tu bolsa. Luego, haz clic en el botón dorado Hacer Pedido 🚀 al final."}
                {tourStep === 6 && "📲 ¡Último paso! Escribe tu nombre para el pedido y haz clic en Enviar a WhatsApp 💬. ¡La asesora te confirmará stock al instante!"}
                {tourStep === 7 && "💖 ¡Miau! ¡Completaste el tutorial con éxito! Tu pedido está en camino a WhatsApp. Gracias por preferirnos. 🐾"}
              </p>

              {/* Acciones del Tour */}
              {tourStep < 7 && (
                <div className="mt-3 flex justify-between items-center gap-2">
                  {/* Botón Atrás */}
                  <button
                    disabled={tourStep === 1}
                    onClick={() => setTourStep(prev => Math.max(1, prev - 1))}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-30 ${isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}`}
                  >
                    Atrás
                  </button>

                  {/* Indicador de pasos (6 pasos interactivos) */}
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6].map(stepNum => (
                      <div 
                        key={stepNum} 
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${tourStep === stepNum ? (isDark ? 'bg-[#e2bd6c] w-3.5' : 'bg-[#e2bd6c] w-3.5') : (isDark ? 'bg-white/10' : 'bg-outline-variant/30')}`}
                      />
                    ))}
                  </div>

                  {/* Botón Siguiente */}
                  <button
                    onClick={() => {
                      if (tourStep < 6) {
                        setTourStep(prev => prev + 1);
                      } else {
                        setTourStep(0);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20 text-[#e2bd6c]' : 'bg-primary/10 hover:bg-primary/20 text-primary'}`}
                  >
                    {tourStep === 6 ? "Finalizar" : "Siguiente"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Imagen de la Gatita Flotante */}
          <div className="relative pointer-events-auto group">
            {/* Efecto de halo brillante */}
            <div className={`absolute inset-0 rounded-full blur-xl opacity-60 scale-95 group-hover:scale-105 transition-transform duration-500 animate-pulse ${isDark ? 'bg-[#e2bd6c]/20' : 'bg-primary/20'}`} />
            
            <img 
              src="/gatita.png" 
              alt="Gatita Yoshita Mascota" 
              className="w-40 h-40 md:w-56 md:h-56 object-contain relative z-10 drop-shadow-2xl animate-in slide-in-from-right-10 duration-500 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              onClick={() => {
                alert("🐾 ¡Miau! Soy Yoshita y estoy lista para guiarte en tu compra.");
              }}
            />
          </div>

        </div>
      )}
    </div>
  )
}
