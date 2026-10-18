import { useState, useEffect, useRef } from 'react'

export function useAutoDemo({
  productos,
  setIsDark,
  setIsSidebarCollapsed,
  setSearchTerm,
  setPrecioMin,
  setPrecioMax,
  setSoloDisponibles,
  setSoloConImagenes,
  setShowTutorial,
  setTourStep,
  setCarrito,
  setIsCartOpen,
  isCartOpen,
  setShowCheckout,
  showCheckout,
  setShowAuthModal,
  showAuthModal,
  setClienteNombre,
  setClienteWhatsapp,
  setFiltroCartCategory,
  setAuthTab,
  setAuthForm,
  productoParaVer,
  setProductoParaVer,
  setIndexImagenActual,
  añadirAlCarrito
}) {
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

  const demoIntervalRef = useRef(null)

  const startAutoDemo = () => {
    // Reset all previous state first to start fresh
    setTourStep(0)
    setSearchTerm('')
    setPrecioMin('')
    setPrecioMax('')
    setSoloDisponibles(false)
    
    // Automatically close the guide box and enable Solo con imágenes filter
    setShowTutorial(false)
    setSoloConImagenes(true)
    
    setCarrito([])
    setIsCartOpen(false)
    setShowCheckout(false)
    setShowAuthModal(false)
    setClienteNombre('')
    setClienteWhatsapp('')
    setFiltroCartCategory('TODOS')
    setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' })
    
    setIsAutoDemo(true)
    setAutoDemoStep(0) // Step 0 is the Intro Logo animation
    setShowDemoIntro(true)
    setShowDemoOutro(false)
    setOutroText('')
    setShowOutroLeis(false)

    // Let the intro logo run for 3.5 seconds before starting step 1
    setTimeout(() => {
      setShowDemoIntro(false)
      setAutoDemoStep(1)
    }, 3500)
  }

  const stopAutoDemo = () => {
    setIsAutoDemo(false)
    setAutoDemoStep(0)
    setAutoDemoCaption('')
    setAutoDemoProgress(0)
    setShowDemoIntro(false)
    setShowDemoOutro(false)
    setOutroText('')
    setShowOutroLeis(false)
    setProductoParaVer(null)
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current)
      demoIntervalRef.current = null
    }
    
    // Final clean up
    setSearchTerm('')
    setCarrito([])
    setIsCartOpen(false)
    setShowCheckout(false)
    setShowAuthModal(false)
    setClienteNombre('')
    setClienteWhatsapp('')
    setFiltroCartCategory('TODOS')
    setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' })
  }

  // Event listener to stop auto-demo when "P" key is pressed
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (isAutoDemo) {
          stopAutoDemo()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isAutoDemo])

  // Outro screen typewriter effect
  useEffect(() => {
    if (!showDemoOutro) {
      setOutroText('')
      setShowOutroLeis(false)
      return
    }
    
    const fullText = "Tu éxito está en nuestros productos"
    let current = ""
    let i = 0
    const interval = setInterval(() => {
      if (i < fullText.length) {
        current += fullText[i]
        setOutroText(current)
        i++
      } else {
        clearInterval(interval)
      }
    }, 70)

    const outroLeisTimer = setTimeout(() => {
      setShowOutroLeis(true)
    }, 2800)

    return () => {
      clearInterval(interval)
      clearTimeout(outroLeisTimer)
    }
  }, [showDemoOutro])

  // Sync pointing arrow with currently highlighted element
  useEffect(() => {
    if (!isAutoDemo || autoDemoStep <= 0) {
      setPointerStyle({ display: 'none' })
      return
    }

    let active = true

    const updatePosition = () => {
      if (!active) return

      const activeEl = document.querySelector('.demo-highlight')
      if (activeEl) {
        const rect = activeEl.getBoundingClientRect()
        
        // Hide if element is not visible or too large (e.g. modals)
        if (rect.width === 0 || rect.height === 0 || rect.width > 500 || rect.height > 500) {
          setPointerStyle({ display: 'none' })
        } else {
          const arrowWidth = 55
          const arrowHeight = 24
          const gap = 12
          
          const isLeftHalf = (rect.left + rect.width / 2) < (window.innerWidth / 2)
          
          if (isLeftHalf) {
            setPointerType('left')
            setPointerStyle({
              display: 'block',
              position: 'fixed',
              top: `${rect.top + rect.height / 2 - arrowHeight / 2}px`,
              left: `${rect.right + gap}px`,
              zIndex: 9999,
              pointerEvents: 'none'
            })
          } else {
            setPointerType('right')
            setPointerStyle({
              display: 'block',
              position: 'fixed',
              top: `${rect.top + rect.height / 2 - arrowHeight / 2}px`,
              left: `${rect.left - gap - arrowWidth}px`,
              zIndex: 9999,
              pointerEvents: 'none'
            })
          }
        }
      } else {
        setPointerStyle({ display: 'none' })
      }

      requestAnimationFrame(updatePosition)
    }

    const delayTimer = setTimeout(() => {
      requestAnimationFrame(updatePosition)
    }, 100)

    return () => {
      active = false
      clearTimeout(delayTimer)
    }
  }, [isAutoDemo, autoDemoStep, productoParaVer, isCartOpen, showCheckout, showAuthModal])

  // Steps Engine
  useEffect(() => {
    if (!isAutoDemo || autoDemoStep <= 0) return

    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current)
      demoIntervalRef.current = null
    }

    const steps = [
      {
        duration: 11000,
        caption: "¡Bienvenido al catálogo Leis! 👑 Puedes alternar fácilmente entre el modo claro y oscuro desde el botón superior.",
        action: () => {
          setIsDark(true)
          setTimeout(() => {
            setIsDark(false)
          }, 4500)
        }
      },
      {
        duration: 7000,
        caption: "Usa el buscador y panel de filtros lateral para encontrar tus joyas favoritas por nombre, SKU o marca.",
        action: () => {
          setIsSidebarCollapsed(false)
        }
      },
      {
        duration: 8000,
        caption: "Escribe el producto que deseas (ej. 'Aceite Collagen') y la lista se filtrará al instante.",
        action: () => {
          const text = "Aceite Collagen"
          let currentText = ""
          let i = 0
          const typeInterval = setInterval(() => {
            if (i < text.length) {
              currentText += text[i]
              setSearchTerm(currentText)
              i++
            } else {
              clearInterval(typeInterval)
            }
          }, 120)
        }
      },
      {
        duration: 10000,
        caption: "Haz clic en el producto para ver su descripción, stock y galería de imágenes en detalle.",
        action: () => {
          const prod = productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
            || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
            || productos.find(p => p.fotoUrl)
          if (prod) {
            setProductoParaVer(prod)
            setIndexImagenActual(0)
            demoIntervalRef.current = setInterval(() => {
              setProductoParaVer(currentProd => {
                if (currentProd && currentProd.id === prod.id) {
                  const pics = currentProd.fotos || (currentProd.fotoUrl ? [currentProd.fotoUrl] : [])
                  if (pics.length > 1) {
                    setIndexImagenActual(prev => (prev + 1) % pics.length)
                  }
                } else {
                  if (demoIntervalRef.current) {
                    clearInterval(demoIntervalRef.current)
                    demoIntervalRef.current = null
                  }
                }
                return currentProd
              })
            }, 3000)
          }
        }
      },
      {
        duration: 7000,
        caption: "Elige tus variantes y haz clic en 'Añadir al Pedido' para sumarlo a tu bolsa de compras.",
        action: () => {
          const prod = productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
            || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
            || productos.find(p => p.fotoUrl)
          if (prod) {
            añadirAlCarrito(prod, null)
            setTimeout(() => {
              setProductoParaVer(null)
            }, 2000)
          }
        }
      },
      {
        duration: 8000,
        caption: "Puedes limpiar la búsqueda y añadir más productos para gestionar un pedido múltiple.",
        action: () => {
          setSearchTerm('')
          setTimeout(() => {
            const prod1 = productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
              || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
              || productos.find(p => p.fotoUrl)
            const prod2 = productos.find(p => p.id !== prod1?.id && p.fotoUrl && (p.stock > 0 || (p.variantes && p.variantes.some(v => v.stock > 0))))
            if (prod2) {
              añadirAlCarrito(prod2, null)
            }
          }, 2000)
        }
      },
      {
        duration: 7000,
        caption: "Abre tu bolsa de compras haciendo clic en el icono del carrito en la cabecera.",
        action: () => {
          setIsCartOpen(true)
        }
      },
      {
        duration: 13000,
        caption: "Ajusta unidades o filtra por categorías en tu bolsa de compras sin alterar el total del pedido.",
        action: () => {
          setTimeout(() => {
            setCarrito(prev => {
              if (prev.length > 0) {
                return prev.map((item, idx) => idx === 0 ? { ...item, cantidad: item.cantidad + 1 } : item)
              }
              return prev
            })
          }, 2500)
          
          setTimeout(() => {
            setCarrito(prev => {
              if (prev.length > 0) {
                const firstProd = productos.find(p => p.id === prev[0].productoId)
                if (firstProd && firstProd.coleccion) {
                  setFiltroCartCategory(firstProd.coleccion.trim().toUpperCase())
                }
              }
              return prev
            })
          }, 5000)

          setTimeout(() => {
            setFiltroCartCategory('TODOS')
          }, 8500)
        }
      },
      {
        duration: 7000,
        caption: "Revisa el resumen y haz clic en 'Hacer Pedido' para iniciar el checkout.",
        action: () => {
          setIsCartOpen(false)
          setTimeout(() => {
            setShowCheckout(true)
          }, 800)
        }
      },
      {
        duration: 9000,
        caption: "Ingresa tu nombre y pulsa 'Enviar a WhatsApp' para finalizar y procesar tu pedido.",
        action: () => {
          const text = "Leis"
          let currentText = ""
          let i = 0
          const typeInterval = setInterval(() => {
            if (i < text.length) {
              currentText += text[i]
              setClienteNombre(currentText)
              i++
            } else {
              clearInterval(typeInterval)
            }
          }, 120)
        }
      },
      {
        duration: 12000,
        caption: "Si eres invitado, puedes registrar tu cuenta al instante para agilizar tus próximas compras.",
        action: () => {
          setShowCheckout(false)
          setTimeout(() => {
            setShowAuthModal(true)
            setAuthTab('register')
            setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' })

            setTimeout(() => {
              const nameVal = "Prueba Leis"
              let i = 0
              const nameTimer = setInterval(() => {
                if (i <= nameVal.length) {
                  setAuthForm(prev => ({ ...prev, nombre: nameVal.substring(0, i) }))
                  i++
                } else {
                  clearInterval(nameTimer)
                  
                  const emailVal = "pruebaleis@gmail.com"
                  let j = 0
                  const emailTimer = setInterval(() => {
                    if (j <= emailVal.length) {
                      setAuthForm(prev => ({ ...prev, email: emailVal.substring(0, j) }))
                      j++
                    } else {
                      clearInterval(emailTimer)
                      
                      const phoneVal = "+56 9 1234 5678"
                      let k = 0
                      const phoneTimer = setInterval(() => {
                        if (k <= phoneVal.length) {
                          setAuthForm(prev => ({ ...prev, whatsapp: phoneVal.substring(0, k) }))
                          k++
                        } else {
                          clearInterval(phoneTimer)
                          
                          const passVal = "123456"
                          let l = 0
                          const passTimer = setInterval(() => {
                            if (l <= passVal.length) {
                              setAuthForm(prev => ({ ...prev, password: passVal.substring(0, l) }))
                              l++
                            } else {
                              clearInterval(passTimer)
                            }
                          }, 80)
                        }
                      }, 80)
                    }
                  }, 80)
                }
              }, 80)
            }, 1000)
          }, 800)
        }
      },
      {
        duration: 10000,
        caption: "¡Y listo! Compras rápidas y seguras en Leis. ¡Gracias por tu preferencia! 💖",
        action: () => {
          setShowAuthModal(false)
          setTimeout(() => {
            setShowDemoOutro(true)
          }, 2500)
        }
      }
    ]

    if (autoDemoStep > steps.length) {
      stopAutoDemo()
      return
    }

    const currentStep = steps[autoDemoStep - 1]
    setAutoDemoCaption(currentStep.caption)
    currentStep.action()

    let timeLeft = currentStep.duration
    const totalTime = currentStep.duration

    const progressInterval = setInterval(() => {
      timeLeft -= 100
      setAutoDemoProgress(Math.max(0, (timeLeft / totalTime) * 100))
      if (timeLeft <= 0) {
        clearInterval(progressInterval)
        setAutoDemoStep(prev => prev + 1)
      }
    }, 100)

    return () => clearInterval(progressInterval)
  }, [isAutoDemo, autoDemoStep])

  return {
    isAutoDemo,
    autoDemoStep,
    autoDemoCaption,
    autoDemoProgress,
    showDemoIntro,
    showDemoOutro,
    outroText,
    showOutroLeis,
    pointerStyle,
    pointerType,
    startAutoDemo,
    stopAutoDemo
  }
}
