import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { collection, onSnapshot, doc, setDoc, getDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db, auth } from './config/firebase'
import { getOptimizedImageUrl } from './utils/image'
import { getHexColor } from './utils/colors'
import { toTitleCase, formatPrice } from './utils/formatters'
import { getCategoriaIcon } from './utils/categories'
import { mergeCarts } from './utils/cart'
import { PulsingRing, GlowingHighlight, FloatingArrow, ProductImagePlaceholder } from './components/common/Indicators'
import BeforeAfterSlider from './components/common/BeforeAfterSlider'
import CheckoutModal from './components/cart/CheckoutModal'
import CartDrawerModal from './components/cart/CartDrawerModal'
import VideoTutorialModal from './components/tutorial/VideoTutorialModal'
import { AuthModal, EditProfileModal, DeleteAccountModal, ResetPasswordModal } from './components/auth'
import { ProductCard, ProductDetailModal, QuickVariantModal, ImageViewerModal } from './components/product'
import { FilterSidebar, Header } from './components/layout'
import { HeroBanner } from './components/hero'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, deleteUser, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth'

// Número de WhatsApp al que llegarán los pedidos (formato internacional sin el +)
const WHATSAPP_NUMBER = "56921648127" // ¡Cambia esto por tu número real!

export default function CatalogoPublico() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    document.title = 'Catálogo Leis'
  }, [])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])
  
  // Filtros Avanzados
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [ordenamiento, setOrdenamiento] = useState('destacados')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [soloConImagenes, setSoloConImagenes] = useState(false)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
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

  // Estado para colapsar barra lateral
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  // Estado para el modal del video tutorial
  const [showVideoModal, setShowVideoModal] = useState(false)

  // Auto-Play Demo Recording states
  const [isAutoDemo, setIsAutoDemo] = useState(false)
  const [autoDemoStep, setAutoDemoStep] = useState(0)
  const [autoDemoCaption, setAutoDemoCaption] = useState('')
  const [autoDemoProgress, setAutoDemoProgress] = useState(0)
  const [showDemoIntro, setShowDemoIntro] = useState(false)
  const [showDemoOutro, setShowDemoOutro] = useState(false)
  const [outroText, setOutroText] = useState('')
  const [showOutroLeis, setShowOutroLeis] = useState(false)
  const [pointerStyle, setPointerStyle] = useState({ display: 'none' })
  const [pointerType, setPointerType] = useState('right') // 'left' or 'right'








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

  // --- MODO DEMO AUTOMÁTICO DE GRABACIÓN ---
  const startAutoDemo = () => {
    // Reset all previous state first to start fresh
    setTourStep(0);
    setSearchTerm('');
    setPrecioMin('');
    setPrecioMax('');
    setSoloDisponibles(false);
    
    // Automatically close the guide box and enable Solo con imágenes filter
    setShowTutorial(false);
    setSoloConImagenes(true);
    
    setCarrito([]);
    setIsCartOpen(false);
    setShowCheckout(false);
    setShowAuthModal(false);
    setClienteNombre('');
    setClienteWhatsapp('');
    setFiltroCartCategory('TODOS');
    setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' });
    
    setIsAutoDemo(true);
    setAutoDemoStep(0); // Step 0 is the Intro Logo animation
    setShowDemoIntro(true);
    setShowDemoOutro(false);
    setOutroText('');
    setShowOutroLeis(false);

    // Let the intro logo run for 3.5 seconds before starting step 1
    setTimeout(() => {
      setShowDemoIntro(false);
      setAutoDemoStep(1);
    }, 3500);
  };

  const stopAutoDemo = () => {
    setIsAutoDemo(false);
    setAutoDemoStep(0);
    setAutoDemoCaption('');
    setAutoDemoProgress(0);
    setShowDemoIntro(false);
    setShowDemoOutro(false);
    setOutroText('');
    setShowOutroLeis(false);
    setProductoParaVer(null);
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    
    // Final clean up
    setSearchTerm('');
    setCarrito([]);
    setIsCartOpen(false);
    setShowCheckout(false);
    setShowAuthModal(false);
    setClienteNombre('');
    setClienteWhatsapp('');
    setFiltroCartCategory('TODOS');
    setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' });
  };

  // Event listener to stop auto-demo when "P" key is pressed
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (isAutoDemo) {
          stopAutoDemo();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isAutoDemo]);



  useEffect(() => {
    if (!isAutoDemo || autoDemoStep <= 0) return;

    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    const steps = [
      {
        duration: 11000,
        caption: "¡Bienvenido al catálogo Leis! 👑 Puedes alternar fácilmente entre el modo claro y oscuro desde el botón superior.",
        action: () => {
          // Demostrar cambio de modo (empezar en oscuro y cambiar a claro)
          setIsDark(true);
          setTimeout(() => {
            setIsDark(false); // Permanecer en modo claro para el resto del tutorial
          }, 4500);
        }
      },
      {
        duration: 7000,
        caption: "Usa el buscador y panel de filtros lateral para encontrar tus joyas favoritas por nombre, SKU o marca.",
        action: () => {
          setIsSidebarCollapsed(false); // Ensure sidebar is open
        }
      },
      {
        duration: 8000,
        caption: "Escribe el producto que deseas (ej. 'Aceite Collagen') y la lista se filtrará al instante.",
        action: () => {
          const text = "Aceite Collagen";
          let currentText = "";
          let i = 0;
          const typeInterval = setInterval(() => {
            if (i < text.length) {
              currentText += text[i];
              setSearchTerm(currentText);
              i++;
            } else {
              clearInterval(typeInterval);
            }
          }, 120);
        }
      },
      {
        duration: 10000,
        caption: "Haz clic en el producto para ver su descripción, stock y galería de imágenes en detalle.",
        action: () => {
          const prod = productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
            || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
            || productos.find(p => p.fotoUrl);
          if (prod) {
            setProductoParaVer(prod);
            setIndexImagenActual(0);
            demoIntervalRef.current = setInterval(() => {
              setProductoParaVer(currentProd => {
                if (currentProd && currentProd.id === prod.id) {
                  const pics = currentProd.fotos || (currentProd.fotoUrl ? [currentProd.fotoUrl] : []);
                  if (pics.length > 1) {
                    setIndexImagenActual(prev => (prev + 1) % pics.length);
                  }
                } else {
                  if (demoIntervalRef.current) {
                    clearInterval(demoIntervalRef.current);
                    demoIntervalRef.current = null;
                  }
                }
                return currentProd;
              });
            }, 3000);
          }
        }
      },
      {
        duration: 7000,
        caption: "Elige tus variantes y haz clic en 'Añadir al Pedido' para sumarlo a tu bolsa de compras.",
        action: () => {
          const prod = productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
            || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
            || productos.find(p => p.fotoUrl);
          if (prod) {
            añadirAlCarrito(prod, null);
            setTimeout(() => {
              setProductoParaVer(null);
            }, 2000);
          }
        }
      },
      {
        duration: 8000,
        caption: "Puedes limpiar la búsqueda y añadir más productos para gestionar un pedido múltiple.",
        action: () => {
          setSearchTerm('');
          setTimeout(() => {
            const prod1 = productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
              || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
              || productos.find(p => p.fotoUrl);
            const prod2 = productos.find(p => p.id !== prod1?.id && p.fotoUrl && (p.stock > 0 || (p.variantes && p.variantes.some(v => v.stock > 0))));
            if (prod2) {
              añadirAlCarrito(prod2, null);
            }
          }, 2000);
        }
      },
      {
        duration: 7000,
        caption: "Abre tu bolsa de compras haciendo clic en el icono del carrito en la cabecera.",
        action: () => {
          setIsCartOpen(true);
        }
      },
      {
        duration: 13000,
        caption: "Ajusta unidades o filtra por categorías en tu bolsa de compras sin alterar el total del pedido.",
        action: () => {
          // Increase quantity of first item
          setTimeout(() => {
            setCarrito(prev => {
              if (prev.length > 0) {
                return prev.map((item, idx) => idx === 0 ? { ...item, cantidad: item.cantidad + 1 } : item);
              }
              return prev;
            });
          }, 2500);
          
          // Switch cart category
          setTimeout(() => {
            setCarrito(prev => {
              if (prev.length > 0) {
                const firstProd = productos.find(p => p.id === prev[0].productoId);
                if (firstProd && firstProd.coleccion) {
                  setFiltroCartCategory(firstProd.coleccion.trim().toUpperCase());
                }
              }
              return prev;
            });
          }, 5000);

          // Return cart category to TODOS
          setTimeout(() => {
            setFiltroCartCategory('TODOS');
          }, 8500);
        }
      },
      {
        duration: 7000,
        caption: "Revisa el resumen y haz clic en 'Hacer Pedido' para iniciar el checkout.",
        action: () => {
          setIsCartOpen(false);
          setTimeout(() => {
            setShowCheckout(true);
          }, 800);
        }
      },
      {
        duration: 9000,
        caption: "Ingresa tu nombre y pulsa 'Enviar a WhatsApp' para finalizar y procesar tu pedido.",
        action: () => {
          const text = "Leis";
          let currentText = "";
          let i = 0;
          const typeInterval = setInterval(() => {
            if (i < text.length) {
              currentText += text[i];
              setClienteNombre(currentText);
              i++;
            } else {
              clearInterval(typeInterval);
            }
          }, 120);
        }
      },
      {
        duration: 12000,
        caption: "Si eres invitado, puedes registrar tu cuenta al instante para agilizar tus próximas compras.",
        action: () => {
          setShowCheckout(false);
          setTimeout(() => {
            setShowAuthModal(true);
            setAuthTab('register');
            setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' });

            // Simulate typing for register form fields
            setTimeout(() => {
              // 1. Type Name
              const nameVal = "Prueba Leis";
              let i = 0;
              const nameTimer = setInterval(() => {
                if (i <= nameVal.length) {
                  setAuthForm(prev => ({ ...prev, nombre: nameVal.substring(0, i) }));
                  i++;
                } else {
                  clearInterval(nameTimer);
                  
                  // 2. Type Email
                  const emailVal = "pruebaleis@gmail.com";
                  let j = 0;
                  const emailTimer = setInterval(() => {
                    if (j <= emailVal.length) {
                      setAuthForm(prev => ({ ...prev, email: emailVal.substring(0, j) }));
                      j++;
                    } else {
                      clearInterval(emailTimer);
                      
                      // 3. Type WhatsApp
                      const phoneVal = "+56 9 1234 5678";
                      let k = 0;
                      const phoneTimer = setInterval(() => {
                        if (k <= phoneVal.length) {
                          setAuthForm(prev => ({ ...prev, whatsapp: phoneVal.substring(0, k) }));
                          k++;
                        } else {
                          clearInterval(phoneTimer);
                          
                          // 4. Type Password
                          const passVal = "123456";
                          let l = 0;
                          const passTimer = setInterval(() => {
                            if (l <= passVal.length) {
                              setAuthForm(prev => ({ ...prev, password: passVal.substring(0, l) }));
                              l++;
                            } else {
                              clearInterval(passTimer);
                            }
                          }, 80);
                        }
                      }, 80);
                    }
                  }, 80);
                }
              }, 80);
            }, 1000);
          }, 800);
        }
      },
      {
        duration: 10000,
        caption: "¡Y listo! Compras rápidas y seguras en Leis. ¡Gracias por tu preferencia! 💖",
        action: () => {
          setShowAuthModal(false);
          setTimeout(() => {
            setShowDemoOutro(true);
          }, 2500);
        }
      }
    ];

    if (autoDemoStep > steps.length) {
      stopAutoDemo();
      return;
    }

    const currentStep = steps[autoDemoStep - 1];
    setAutoDemoCaption(currentStep.caption);
    currentStep.action();

    let timeLeft = currentStep.duration;
    const totalTime = currentStep.duration;

    const progressInterval = setInterval(() => {
      timeLeft -= 100;
      setAutoDemoProgress(Math.max(0, (timeLeft / totalTime) * 100));
      if (timeLeft <= 0) {
        clearInterval(progressInterval);
        setAutoDemoStep(prev => prev + 1);
      }
    }, 100);

    return () => clearInterval(progressInterval);
  }, [isAutoDemo, autoDemoStep]);


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
  const demoIntervalRef = useRef(null)

  const [animacion, setAnimacion] = useState('') // '', 'salir-izquierda', 'salir-derecha', etc.
  const [indexImagenActual, setIndexImagenActual] = useState(0)
  const [mostrarIndicador, setMostrarIndicador] = useState(false)
  const [mostrarControlesZoom, setMostrarControlesZoom] = useState(true)
  const [expandedImage, setExpandedImage] = useState(null)
  const [isModalImgLoading, setIsModalImgLoading] = useState(false)
  const [modoAntesDespues, setModoAntesDespues] = useState(false)
  const [indexFotoAntes, setIndexFotoAntes] = useState(0)
  const [indexFotoDespues, setIndexFotoDespues] = useState(1)
  const [selectedColorByProduct, setSelectedColorByProduct] = useState({})
  const [openColorDropdownId, setOpenColorDropdownId] = useState(null)
  const [varianteDetalle, setVarianteDetalle] = useState(null)



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

  // Outro screen typewriter effect
  useEffect(() => {
    if (!showDemoOutro) {
      setOutroText('');
      setShowOutroLeis(false);
      return;
    }
    
    const fullText = "Tu éxito está en nuestros productos";
    let current = "";
    let i = 0;
    const interval = setInterval(() => {
      if (i < fullText.length) {
        current += fullText[i];
        setOutroText(current);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 70);

    const outroLeisTimer = setTimeout(() => {
      setShowOutroLeis(true);
    }, 2800);

    return () => {
      clearInterval(interval);
      clearTimeout(outroLeisTimer);
    };
  }, [showDemoOutro]);

  // Sync the pointing arrow with the currently highlighted demo-highlight element
  useEffect(() => {
    if (!isAutoDemo || autoDemoStep <= 0) {
      setPointerStyle({ display: 'none' });
      return;
    }

    let active = true;

    const updatePosition = () => {
      if (!active) return;

      const activeEl = document.querySelector('.demo-highlight');
      if (activeEl) {
        const rect = activeEl.getBoundingClientRect();
        
        // Hide if element is not visible or too large (e.g. modals)
        if (rect.width === 0 || rect.height === 0 || rect.width > 500 || rect.height > 500) {
          setPointerStyle({ display: 'none' });
        } else {
          const arrowWidth = 55;
          const arrowHeight = 24;
          const gap = 12;
          
          // Determine side based on screen half
          const isLeftHalf = (rect.left + rect.width / 2) < (window.innerWidth / 2);
          
          if (isLeftHalf) {
            // Place arrow to the right of the element, pointing left
            setPointerType('left');
            setPointerStyle({
              display: 'block',
              position: 'fixed',
              top: `${rect.top + rect.height / 2 - arrowHeight / 2}px`,
              left: `${rect.right + gap}px`,
              zIndex: 9999,
              pointerEvents: 'none'
            });
          } else {
            // Place arrow to the left of the element, pointing right
            setPointerType('right');
            setPointerStyle({
              display: 'block',
              position: 'fixed',
              top: `${rect.top + rect.height / 2 - arrowHeight / 2}px`,
              left: `${rect.left - gap - arrowWidth}px`,
              zIndex: 9999,
              pointerEvents: 'none'
            });
          }
        }
      } else {
        setPointerStyle({ display: 'none' });
      }

      requestAnimationFrame(updatePosition);
    };

    // Delay start slightly to let layout settle
    const delayTimer = setTimeout(() => {
      requestAnimationFrame(updatePosition);
    }, 100);

    return () => {
      active = false;
      clearTimeout(delayTimer);
    };
  }, [isAutoDemo, autoDemoStep, productoParaVer, isCartOpen, showCheckout, showAuthModal]);

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
      const data = snapshot.docs.map(dDoc => {
        const dData = dDoc.data()
        return { id: dDoc.id, ...dData, nombre: toTitleCase(dData.nombre) }
      })
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

  const categoryCounts = useMemo(() => {
    const counts = { TODAS: productosVisibles.length }
    productosVisibles.forEach(p => {
      const cat = (p.coleccion || '').trim().toUpperCase()
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1
      }
    })
    return counts
  }, [productosVisibles])

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
  }).sort((a, b) => {
    if (ordenamiento === 'precio_asc') {
      return (Number(a.precio) || 0) - (Number(b.precio) || 0);
    }
    if (ordenamiento === 'precio_desc') {
      return (Number(b.precio) || 0) - (Number(a.precio) || 0);
    }
    if (ordenamiento === 'recientes') {
      const dateA = new Date(a.fechaIngreso || a.createdAt || 0).getTime();
      const dateB = new Date(b.fechaIngreso || b.createdAt || 0).getTime();
      return dateB - dateA;
    }
    if (ordenamiento === 'mas_vendidos') {
      const ventasA = Number(a.ventasTotal || a.ventasCount || a.stockInvertido || 0);
      const ventasB = Number(b.ventasTotal || b.ventasCount || b.stockInvertido || 0);
      if (ventasB !== ventasA) return ventasB - ventasA;
    }

    // Por defecto (Destacados): productos con fotos primero
    const aTieneFoto = !!(a.fotoUrl || (a.fotos && a.fotos.length > 0 && a.fotos[0]));
    const bTieneFoto = !!(b.fotoUrl || (b.fotos && b.fotos.length > 0 && b.fotos[0]));
    if (aTieneFoto && !bTieneFoto) return -1;
    if (!aTieneFoto && bTieneFoto) return 1;
    return 0;
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

  const fotosProducto = useMemo(() => {
    if (!productoParaVer) return [];
    if (varianteDetalle) {
      const vFotos = Array.isArray(varianteDetalle.fotos) ? varianteDetalle.fotos.filter(Boolean) : (varianteDetalle.fotoUrl ? [varianteDetalle.fotoUrl] : []);
      if (vFotos.length > 0) return vFotos;
    }
    return productoParaVer.fotos && productoParaVer.fotos.length > 0
      ? productoParaVer.fotos
      : (productoParaVer.fotoUrl ? [productoParaVer.fotoUrl] : []);
  }, [productoParaVer, varianteDetalle]);

  function anteriorImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('hoja-pasar-atras-salir');
    setTimeout(() => {
      setIsModalImgLoading(true);
      setIndexImagenActual(prev => (prev === 0 ? fotosProducto.length - 1 : prev - 1));
      setAnimacion('hoja-pasar-atras-entrar');
      setTimeout(() => setAnimacion(''), 320);
    }, 280);
  }

  function siguienteImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('hoja-pasar-adelante-salir');
    setTimeout(() => {
      setIsModalImgLoading(true);
      setIndexImagenActual(prev => (prev === fotosProducto.length - 1 ? 0 : prev + 1));
      setAnimacion('hoja-pasar-adelante-entrar');
      setTimeout(() => setAnimacion(''), 320);
    }, 280);
  }

  function irAImagen(targetIndex) {
    if (targetIndex === indexImagenActual || animacion || targetIndex < 0 || targetIndex >= fotosProducto.length) return;
    const esAdelante = targetIndex > indexImagenActual;
    setAnimacion(esAdelante ? 'hoja-pasar-adelante-salir' : 'hoja-pasar-atras-salir');
    setTimeout(() => {
      setIsModalImgLoading(true);
      setIndexImagenActual(targetIndex);
      setAnimacion(esAdelante ? 'hoja-pasar-adelante-entrar' : 'hoja-pasar-atras-entrar');
      setTimeout(() => setAnimacion(''), 320);
    }, 280);
  }

  useEffect(() => {
    if (productoParaVer) {
      if (productoParaVer.variantes && productoParaVer.variantes.length > 0) {
        const preselectedName = selectedColorByProduct[productoParaVer.id];
        const initial = productoParaVer.variantes.find(v => v.nombre === preselectedName) || productoParaVer.variantes[0];
        setVarianteDetalle(initial);
      } else {
        setVarianteDetalle(null);
      }
    } else {
      setVarianteDetalle(null);
    }
    setIndexImagenActual(0);
    setAnimacion('');
    setIsModalImgLoading(false);
    setModoAntesDespues(false);
    setIndexFotoAntes(0);
    setIndexFotoDespues(1);
  }, [productoParaVer]);

  useEffect(() => {
    // Precarga automática e instantánea de todas las fotos en memoria
    if (fotosProducto && fotosProducto.length > 0) {
      fotosProducto.forEach(url => {
        if (url) {
          const img = new Image();
          img.src = getOptimizedImageUrl(url, 900);
        }
      });
    }
  }, [fotosProducto]);

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
  const [itemsVisiblesTodas, setItemsVisiblesTodas] = useState(20)
  const ITEMS_POR_PAGINA = 20

  useEffect(() => {
    setPaginaActual(1)
    setItemsVisiblesTodas(ITEMS_POR_PAGINA)
  }, [filtroCategoria])

  useEffect(() => {
    if (mainScrollRef.current && filtroCategoria !== 'TODAS') {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [paginaActual])

  const isTodas = filtroCategoria === 'TODAS'
  const totalPaginas = isTodas ? 1 : Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA)
  const productosPaginados = isTodas
    ? productosFiltrados.slice(0, itemsVisiblesTodas)
    : productosFiltrados.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA)

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
      const preselectedName = selectedColorByProduct[p.id];
      const match = p.variantes.find(v => v.nombre === preselectedName && Number(v.stock) > 0)
        || p.variantes.find(v => Number(v.stock) > 0)
        || p.variantes[0];
      setVarianteSeleccionada(match || '')
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
    const itemFoto = (variante?.fotos && variante.fotos[0]) || variante?.fotoUrl || producto.fotoUrl || ''

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
          fotoUrl: itemFoto,
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

  // Pre-calculate demo products to highlight in the catalog grid
  const demoProd1 = isAutoDemo ? (productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
    || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
    || productos.find(p => p.fotoUrl)) : null;
  const demoProd2 = isAutoDemo && demoProd1 ? productos.find(p => p.id !== demoProd1.id && p.fotoUrl && (p.stock > 0 || (p.variantes && p.variantes.some(v => v.stock > 0)))) : null;

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-surface text-on-surface">Cargando catálogo...</div>
  }

  return (
    <div className={`flex h-[100dvh] ${isDark ? 'bg-[#0c0c0c]' : 'bg-surface'} relative overflow-hidden transition-colors duration-500`}>

      {/* ── PANEL LATERAL (SIDEBAR DE FILTROS) ── */}
      <FilterSidebar
        isDark={isDark}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        precioMin={precioMin}
        setPrecioMin={setPrecioMin}
        precioMax={precioMax}
        setPrecioMax={setPrecioMax}
        filtroCategoria={filtroCategoria}
        setFiltroCategoria={setFiltroCategoria}
        categorySearchTerm={categorySearchTerm}
        setCategorySearchTerm={setCategorySearchTerm}
        categoriasUnicas={categoriasUnicas}
        categoryCounts={categoryCounts}
        setSoloDisponibles={setSoloDisponibles}
        setSoloConImagenes={setSoloConImagenes}
        totalResultados={productosFiltrados.length}
        tourStep={tourStep}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* HEADER PRINCIPAL COMPACTO */}
        <Header
          isDark={isDark}
          setIsDark={setIsDark}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          showTutorial={showTutorial}
          setShowTutorial={setShowTutorial}
          currentUser={currentUser}
          userData={userData}
          handleLogout={handleLogout}
          onOpenEditProfile={() => {
            setEditProfileForm({
              nombre: currentUser?.displayName || '',
              whatsapp: userData?.whatsapp || ''
            })
            setEditProfileError('')
            setEditProfileSuccess('')
            setShowEditProfileModal(true)
          }}
          onOpenResetPassword={() => {
            setResetEmailSuccess('')
            setResetEmailError('')
            setShowResetPasswordModal(true)
          }}
          setShowAuthModal={setShowAuthModal}
          totalItems={totalItems}
          setIsCartOpen={setIsCartOpen}
          tourStep={tourStep}
          isAutoDemo={isAutoDemo}
          autoDemoStep={autoDemoStep}
        />

        {/* MAIN SCROLLABLE AREA */}
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10 pb-32 md:pb-8">
          <div className="max-w-7xl mx-auto">
            
            {/* ── HERO BANNER PRINCIPAL DE INICIO ── */}
            <HeroBanner
              isDark={isDark}
              categoriasUnicas={categoriasUnicas}
              filtroCategoria={filtroCategoria}
              setFiltroCategoria={setFiltroCategoria}
              soloDisponibles={soloDisponibles}
              setSoloDisponibles={setSoloDisponibles}
              productos={productos}
              setProductoParaVer={setProductoParaVer}
            />

            {/* ── ENCABEZADO DE CATEGORÍA / PRODUCTOS (DEBAJO DEL HERO BANNER) ── */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 animate-in fade-in slide-in-from-top-2 duration-300 border-b pb-5 border-white/5">
              <div>
                <h2 className={`font-headline text-2xl md:text-3xl font-bold italic leading-tight ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                  {filtroCategoria === 'TODAS' ? 'Todos los Productos' : filtroCategoria}
                </h2>
                <p className={`text-xs font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                  {filtroCategoria === 'TODAS' 
                    ? 'Explora nuestra colección completa de joyería y cuidado personal.' 
                    : `Mostrando productos de la categoría ${filtroCategoria}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto shrink-0">
                {/* Contador de Productos */}
                <span className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-2xl border shadow-sm flex items-center gap-2 ${
                  isDark ? 'bg-white/5 border-white/10 text-[#e2bd6c]' : 'bg-surface-container-high border-outline-variant/30 text-primary'
                }`}>
                  <span className="material-symbols-outlined text-base">inventory_2</span>
                  {productosFiltrados.length} {productosFiltrados.length === 1 ? 'PRODUCTO' : 'PRODUCTOS'}
                </span>

                {/* SELECTOR DE ORDENAMIENTO PERSONALIZADO LUXE (CUSTOM DROPDOWN) */}
                {(() => {
                  const opcionesOrden = [
                    { id: 'destacados', label: 'Ordenar por: Destacados', icon: 'auto_awesome' },
                    { id: 'precio_asc', label: 'Precio: Menor a Mayor', icon: 'arrow_upward' },
                    { id: 'precio_desc', label: 'Precio: Mayor a Menor', icon: 'arrow_downward' },
                    { id: 'recientes', label: 'Más recientes', icon: 'schedule' },
                    { id: 'mas_vendidos', label: 'Más vendidos', icon: 'local_fire_department' },
                  ];
                  const opcionActual = opcionesOrden.find(o => o.id === ordenamiento) || opcionesOrden[0];

                  return (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsSortOpen(!isSortOpen)}
                        className={`px-4 py-2.5 rounded-2xl border text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-sm flex items-center gap-2.5 backdrop-blur-md select-none ${
                          isDark 
                            ? 'bg-[#151515] border-[#e2bd6c]/30 text-white hover:border-[#e2bd6c] hover:bg-white/5' 
                            : 'bg-white border-outline-variant/30 text-on-surface hover:border-primary hover:bg-surface-container-low'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-base ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
                          swap_vert
                        </span>
                        <span>{opcionActual.label}</span>
                        <span className={`material-symbols-outlined text-base transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isSortOpen ? 'rotate-180' : ''}`}>
                          expand_more
                        </span>
                      </button>

                      {/* MENÚ DESPLEGABLE CON DISEÑO REDONDEADO Y GLASSMORPHISM (POPOVER) */}
                      {isSortOpen && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setIsSortOpen(false)} 
                          />
                          <div className={`absolute right-0 top-full mt-2.5 w-64 rounded-2xl border shadow-2xl z-50 p-2 space-y-1 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
                            isDark 
                              ? 'bg-[#1e1e1e]/95 border-[#e2bd6c]/30 text-white shadow-black/80' 
                              : 'bg-white/95 border-outline-variant/20 text-on-surface shadow-black/10'
                          }`}>
                            {opcionesOrden.map(op => {
                              const isSelected = ordenamiento === op.id;
                              return (
                                <button
                                  key={op.id}
                                  type="button"
                                  onClick={() => {
                                    setOrdenamiento(op.id);
                                    setIsSortOpen(false);
                                  }}
                                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer ${
                                    isSelected
                                      ? (isDark 
                                          ? 'bg-gradient-to-r from-[#e2bd6c]/25 to-[#e2bd6c]/10 border border-[#e2bd6c]/40 text-[#e2bd6c] shadow-sm' 
                                          : 'bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 text-primary shadow-sm')
                                      : (isDark 
                                          ? 'text-gray-300 hover:bg-white/5 hover:text-white' 
                                          : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface')
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className={`material-symbols-outlined text-base ${isSelected ? (isDark ? 'text-[#e2bd6c]' : 'text-primary') : 'text-gray-500'}`}>
                                      {op.icon}
                                    </span>
                                    <span>{op.label}</span>
                                  </div>
                                  {isSelected && (
                                    <span className={`material-symbols-outlined text-base font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
                                      check
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
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
                    onClick={() => setShowVideoModal(true)}
                    className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${isDark ? 'bg-[#e2bd6c] text-black shadow-[#e2bd6c]/20' : 'bg-primary text-on-primary shadow-primary/20'}`}
                  >
                    <span className="material-symbols-outlined text-sm">smart_display</span>
                    Ver Video Tutorial 🎬
                  </button>

                  <button
                    onClick={() => setTourStep(1)}
                    className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 border cursor-pointer ${
                      isDark 
                        ? 'border-[#e2bd6c]/30 text-[#e2bd6c] hover:bg-[#e2bd6c]/10 bg-[#e2bd6c]/10 shadow-md shadow-[#e2bd6c]/10' 
                        : 'border-primary/30 text-primary hover:bg-primary/5 bg-primary/10 shadow-sm'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm animate-pulse">play_circle</span>
                    Iniciar viaje de prueba 🐾
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
            <div className={`grid gap-4 md:gap-6 ${
              isSidebarCollapsed 
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' 
                : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }`}>
              {productosPaginados.map((p, pIndex) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  pIndex={pIndex}
                  isDark={isDark}
                  carrito={carrito}
                  tourStep={tourStep}
                  isAutoDemo={isAutoDemo}
                  autoDemoStep={autoDemoStep}
                  demoProd1={demoProd1}
                  demoProd2={demoProd2}
                  selectedColorByProduct={selectedColorByProduct}
                  setSelectedColorByProduct={setSelectedColorByProduct}
                  openColorDropdownId={openColorDropdownId}
                  setOpenColorDropdownId={setOpenColorDropdownId}
                  setProductoParaVer={setProductoParaVer}
                  abrirModalAñadir={abrirModalAñadir}
                  añadirAlCarrito={añadirAlCarrito}
                  actualizarCantidad={actualizarCantidad}
                  eliminarDelCarrito={eliminarDelCarrito}
                  animateFlyToCart={animateFlyToCart}
                />
              ))}
            </div>
            
            {isTodas ? (
              /* MODO 'VER MÁS' PARA CATEGORÍA 'TODAS' */
              <div className="mt-12 flex flex-col items-center justify-center gap-3">
                {itemsVisiblesTodas < productosFiltrados.length ? (
                  <>
                    <p className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                      Viendo <span className={isDark ? 'text-[#e2bd6c]' : 'text-primary'}>{productosPaginados.length}</span> de <span className={isDark ? 'text-white' : 'text-on-surface'}>{productosFiltrados.length}</span> productos
                    </p>
                    <button
                      onClick={() => setItemsVisiblesTodas(prev => prev + ITEMS_POR_PAGINA)}
                      className={`px-8 py-3.5 rounded-2xl font-headline font-bold text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 hover:scale-105 ${
                        isDark 
                          ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90 shadow-[#e2bd6c]/20' 
                          : 'bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg font-bold">expand_more</span>
                      <span>Ver más productos</span>
                    </button>
                  </>
                ) : (
                  productosFiltrados.length > 0 && (
                    <div className={`py-3 px-6 rounded-2xl border text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-surface-variant/40 border-outline-variant/20 text-outline'
                    }`}>
                      ✨ Has visto todos los {productosFiltrados.length} productos
                    </div>
                  )
                )}
              </div>
            ) : (
              /* PAGINACIÓN NUMÉRICA (1, 2, 3...) PARA CATEGORÍAS ESPECÍFICAS */
              totalPaginas > 1 && (
                <div className="mt-10 flex justify-center items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setPaginaActual(prev => Math.max(prev - 1, 1))
                      if (mainScrollRef.current) {
                        mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
                      }
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
                        if (mainScrollRef.current) {
                          mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
                        }
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
                      if (mainScrollRef.current) {
                        mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
                      }
                    }}
                    disabled={paginaActual === totalPaginas}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl border disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'}`}
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              )
            )}
          </>
        )}

            {/* FOOTER DEL CATALOGO */}
            <footer className="mt-16 pt-16 pb-12 border-t border-outline-variant/10 dark:border-white/5 flex flex-col items-center gap-4 opacity-50">
              <div className="flex items-center gap-3">
                <span className={`font-headline font-bold text-sm tracking-tight ${isDark ? 'text-white/80' : 'text-on-surface/80'}`}>Leis Catálogo V1.5</span>
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

      {/* ── MODAL PREMIUM DEL CARRITO ── */}
      <CartDrawerModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        isDark={isDark}
        carrito={carrito}
        productos={productos}
        categoriasEnCarrito={categoriasEnCarrito}
        filtroCartCategory={filtroCartCategory}
        setFiltroCartCategory={setFiltroCartCategory}
        actualizarCantidad={actualizarCantidad}
        eliminarDelCarrito={eliminarDelCarrito}
        totalCarrito={totalCarrito}
        prepararCheckout={prepararCheckout}
        tourStep={tourStep}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* MODAL SELECCIÓN DE VARIANTES */}
      <QuickVariantModal
        isOpen={Boolean(productParaAñadir)}
        onClose={() => setProductParaAñadir(null)}
        isDark={isDark}
        productParaAñadir={productParaAñadir}
        varianteSeleccionada={varianteSeleccionada}
        setVarianteSeleccionada={setVarianteSeleccionada}
        carrito={carrito}
        setSelectedColorByProduct={setSelectedColorByProduct}
        animateFlyToCart={animateFlyToCart}
        añadirAlCarrito={añadirAlCarrito}
      />

      {/* MODAL DETALLE DE PRODUCTO */}
      <ProductDetailModal
        isOpen={Boolean(productoParaVer)}
        onClose={() => setProductoParaVer(null)}
        isDark={isDark}
        productoParaVer={productoParaVer}
        fotosProducto={fotosProducto}
        indexImagenActual={indexImagenActual}
        setIndexImagenActual={setIndexImagenActual}
        animacion={animacion}
        setAnimacion={setAnimacion}
        isModalImgLoading={isModalImgLoading}
        setIsModalImgLoading={setIsModalImgLoading}
        irAImagen={irAImagen}
        anteriorImagen={anteriorImagen}
        siguienteImagen={siguienteImagen}
        mostrarIndicador={mostrarIndicador}
        setExpandedImage={setExpandedImage}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        varianteDetalle={varianteDetalle}
        setVarianteDetalle={setVarianteDetalle}
        selectedColorByProduct={selectedColorByProduct}
        setSelectedColorByProduct={setSelectedColorByProduct}
        animateFlyToCart={animateFlyToCart}
        añadirAlCarrito={añadirAlCarrito}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* MODAL CHECKOUT WHATSAPP */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        isDark={isDark}
        currentUser={currentUser}
        clienteNombre={clienteNombre}
        setClienteNombre={setClienteNombre}
        onEnviarPedido={enviarPedidoWhatsApp}
        onOpenAuth={() => {
          setShowCheckout(false);
          setShowAuthModal(true);
        }}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
        tourStep={tourStep}
      />
      {/* VISOR DE IMAGEN AMPLIADA (ZOOM) CON NAVEGACIÓN */}
      <ImageViewerModal
        isOpen={Boolean(expandedImage)}
        onClose={() => setExpandedImage(null)}
        fotosProducto={fotosProducto}
        indexImagenActual={indexImagenActual}
        mostrarControlesZoom={mostrarControlesZoom}
        anteriorImagen={anteriorImagen}
        siguienteImagen={siguienteImagen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        animacion={animacion}
        position={position}
        scale={scale}
        setScale={setScale}
        resetZoom={resetZoom}
      />

      {/* ── MODAL VIDEO TUTORIAL ── */}
      <VideoTutorialModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        isDark={isDark}
      />

      {/* MODAL DE AUTENTICACIÓN */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        isDark={isDark}
        authTab={authTab}
        setAuthTab={setAuthTab}
        authForm={authForm}
        setAuthForm={setAuthForm}
        handleAuthSubmit={handleAuthSubmit}
        isAuthLoading={isAuthLoading}
        authError={authError}
        setAuthError={setAuthError}
        authSuccess={authSuccess}
        setAuthSuccess={setAuthSuccess}
        forgotEmail={forgotEmail}
        setForgotEmail={setForgotEmail}
        handleSendResetEmailForgot={handleSendResetEmailForgot}
        isResetEmailLoading={isResetEmailLoading}
        resetEmailError={resetEmailError}
        setResetEmailError={setResetEmailError}
        resetEmailSuccess={resetEmailSuccess}
        setResetEmailSuccess={setResetEmailSuccess}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* MODAL DE EDITAR PERFIL */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        isDark={isDark}
        editProfileForm={editProfileForm}
        setEditProfileForm={setEditProfileForm}
        handleUpdateProfile={handleUpdateProfile}
        isEditProfileLoading={isEditProfileLoading}
        editProfileError={editProfileError}
        editProfileSuccess={editProfileSuccess}
        onOpenDeleteAccount={() => {
          setDeletePassword('')
          setDeleteAccountError('')
          setDeleteAccountSuccess('')
          setShowDeleteAccountModal(true)
          setShowEditProfileModal(false)
        }}
      />

      {/* MODAL DE ELIMINAR CUENTA */}
      <DeleteAccountModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        isDark={isDark}
        deletePassword={deletePassword}
        setDeletePassword={setDeletePassword}
        handleDeleteAccount={handleDeleteAccount}
        isDeleteAccountLoading={isDeleteAccountLoading}
        deleteAccountError={deleteAccountError}
        deleteAccountSuccess={deleteAccountSuccess}
      />

      {/* MODAL DE RESTABLECER CONTRASEÑA */}
      <ResetPasswordModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        isDark={isDark}
        currentUser={currentUser}
        handleSendResetEmailLoggedIn={handleSendResetEmailLoggedIn}
        isResetEmailLoading={isResetEmailLoading}
        resetEmailError={resetEmailError}
        resetEmailSuccess={resetEmailSuccess}
      />


      {/* ── DEMO INTRO SCREEN OVERLAY (ESTRELLA FUGAZ - MODO CLARO) ── */}
      {showDemoIntro && (
        <div className="fixed inset-0 z-[250] bg-gradient-to-br from-[#fdfaf5] via-[#fdfbfa] to-[#ebdcb9] flex flex-col items-center justify-center overflow-hidden animate-out fade-out zoom-out-95 duration-700 delay-[2800ms]">
          {/* Subtle sparkling background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(226,189,108,0.12)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="relative flex flex-col items-center justify-center p-6 text-center select-none transform transition-transform duration-[3s] scale-95 animate-in zoom-in-95 duration-500">
            {/* Logo Container with star-sweep effect - perfectly circular and larger */}
            <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-[#e2bd6c]/50 shadow-[0_10px_40px_rgba(226,189,108,0.2)] relative bg-white/95 flex items-center justify-center star-sweep-effect animate-slow-breath">
              <img 
                src="/logo.jpeg" 
                alt="Logo Leis" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            
            {/* Glowing Aura under the logo */}
            <div className="absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-gradient-to-r from-[#e2bd6c] to-[#ebdcb9] opacity-40 blur-3xl -z-10 animate-pulse" />

            {/* Premium Slogan */}
            <div className="mt-8 space-y-2 animate-in slide-in-from-bottom-5 duration-700 delay-300">
              <h1 className="font-headline text-2xl sm:text-3xl font-black tracking-[0.3em] uppercase select-none drop-shadow-[0_0_20px_rgba(226,189,108,0.3)] flex items-center justify-center pl-[0.3em] min-h-[36px] sm:min-h-[44px]">
                {"LEIS".split("").map((letter, idx) => (
                  <span 
                    key={idx}
                    className="text-transparent bg-clip-text bg-gradient-to-r from-[#be9440] via-[#e2bd6c] to-[#be9440] inline-block animate-intro-letter text-glow-shine"
                    style={{ animationDelay: `${idx * 0.08}s` }}
                  >
                    {letter}
                  </span>
                ))}
              </h1>
              <p className="text-[9px] sm:text-[11px] font-bold tracking-[0.25em] text-[#5d3a28]/70 uppercase">
                Tu éxito está en nuestros productos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── DEMO OUTRO SCREEN OVERLAY (FINAL DE LUJO - MODO CLARO) ── */}
      {showDemoOutro && (
        <div className="fixed inset-0 z-[250] bg-gradient-to-br from-[#fdfaf5] via-[#fdfbfa] to-[#ebdcb9] flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-700">
          {/* Subtle sparkling background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(226,189,108,0.12)_0%,transparent_70%)] pointer-events-none" />

          <div className="relative flex flex-col items-center justify-center p-6 text-center select-none transform transition-all duration-[3s] scale-100 animate-in zoom-in-95 duration-500">
            {/* Logo Container with star-sweep effect */}
            <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-[#e2bd6c]/50 shadow-[0_10px_40px_rgba(226,189,108,0.2)] relative bg-white/95 flex items-center justify-center star-sweep-effect animate-slow-breath">
              <img 
                src="/logo.jpeg" 
                alt="Logo Leis" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            
            {/* Glowing Aura under the logo */}
            <div className="absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-gradient-to-r from-[#e2bd6c] to-[#ebdcb9] opacity-40 blur-3xl -z-10 animate-pulse" />

            {/* Slogan with Shiny, Typewriter and Glowing Effect */}
            <div className="mt-10 space-y-4">
              <p className="min-h-[24px] text-xs sm:text-sm font-bold tracking-[0.25em] uppercase text-[#5d3a28]/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300">
                {outroText}
                <span className="animate-ping duration-300 text-[#e2bd6c]">|</span>
              </p>
              
              {showOutroLeis && (
                <h1 className="font-headline text-3xl sm:text-5xl font-black tracking-[0.3em] uppercase select-none drop-shadow-[0_0_20px_rgba(226,189,108,0.4)] flex items-center justify-center pl-[0.3em]">
                  {"LEIS".split("").map((letter, idx) => (
                    <span 
                      key={idx}
                      className="text-transparent bg-clip-text bg-gradient-to-r from-[#be9440] via-[#e2bd6c] to-[#be9440] inline-block animate-outro-letter text-glow-shine"
                      style={{ animationDelay: `${idx * 0.18}s` }}
                    >
                      {letter}
                    </span>
                  ))}
                </h1>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DYNAMIC DEMO POINTER ARROW ── */}
      {isAutoDemo && pointerStyle.display !== 'none' && (
        <div style={pointerStyle}>
          {pointerType === 'left' ? (
            <svg width="55" height="24" viewBox="0 0 55 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-point-left drop-shadow-[0_0_12px_rgba(226,189,108,0.7)]">
              <defs>
                <linearGradient id="gold-grad-left" x1="100%" y1="50%" x2="0%" y2="50%">
                  <stop offset="0%" stopColor="#9a7629" />
                  <stop offset="50%" stopColor="#e2bd6c" />
                  <stop offset="100%" stopColor="#fff2cc" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="12" r="3" fill="url(#gold-grad-left)" />
              <path d="M47 12H5" stroke="url(#gold-grad-left)" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M13 4L4.5 12.5L13 21" stroke="url(#gold-grad-left)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="55" height="24" viewBox="0 0 55 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-point-right drop-shadow-[0_0_12px_rgba(226,189,108,0.7)]">
              <defs>
                <linearGradient id="gold-grad-right" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#9a7629" />
                  <stop offset="50%" stopColor="#e2bd6c" />
                  <stop offset="100%" stopColor="#fff2cc" />
                </linearGradient>
              </defs>
              <circle cx="5" cy="12" r="3" fill="url(#gold-grad-right)" />
              <path d="M8 12H50" stroke="url(#gold-grad-right)" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M42 4L50.5 12.5L42 21" stroke="url(#gold-grad-right)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* ── AUTOMATED DEMO FLOATING SUBTITLES BANNER ── */}
      {isAutoDemo && !showDemoIntro && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-xl px-4 animate-in slide-in-from-top-5 duration-300 pointer-events-none">
          {/* Mascot Leis (Gatita Yoshita) floating to the left, outside the card (desktop only) */}
          <div className="absolute -left-24 top-1/2 -translate-y-1/2 pointer-events-auto select-none hidden sm:block">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full blur-md opacity-40 bg-[#e2bd6c]/30 scale-75 group-hover:scale-100 transition-transform duration-500 animate-pulse animate-duration-1000" />
              <img 
                src="/gatita.png" 
                alt="Mascota Leis" 
                className="w-20 h-20 object-contain relative z-10 drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] animate-smooth-float"
                title="Leis 🐾"
              />
            </div>
          </div>

          <div className={`p-4 rounded-[24px] border shadow-2xl backdrop-blur-md flex flex-col gap-3 relative overflow-hidden pointer-events-auto ${
            isDark 
              ? 'bg-[#151515]/95 border-[#e2bd6c]/30 text-white shadow-black/85' 
              : 'bg-white/95 border-primary/20 text-on-surface shadow-black/20'
          }`}>
            {/* Mascot and Subtitle Caption */}
            <div className="flex items-center gap-3">
              {/* Mascot Leis (Gatita Yoshita) inside ONLY for mobile */}
              <div className="relative shrink-0 select-none sm:hidden">
                <div className={`absolute inset-0 rounded-full blur-sm opacity-50 bg-[#e2bd6c]/20`} />
                <img 
                  src="/gatita.png" 
                  alt="Mascota Leis" 
                  className="w-12 h-12 object-contain relative z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] animate-smooth-float"
                  title="Leis 🐾"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black tracking-widest uppercase mb-0.5 opacity-60 text-[#e2bd6c]">
                  Leis 🐾
                </p>
                <p className="text-[11px] sm:text-xs leading-relaxed font-bold italic">
                  "{autoDemoCaption}"
                </p>
              </div>
            </div>

            {/* Progress Bar (Hidden Detener button, stop with key P) */}
            <div className="flex items-center justify-between gap-4 mt-1">
              <div className="flex-1 h-1 bg-outline-variant/20 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ease-linear ${isDark ? 'bg-[#e2bd6c]' : 'bg-primary'}`}
                  style={{ width: `${autoDemoProgress}%` }}
                />
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
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg text-[10px] font-black uppercase tracking-wider animate-pulse transition-all hover:scale-105 active:scale-95 ${
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
