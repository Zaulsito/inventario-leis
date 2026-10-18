import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './config/firebase'
import { toTitleCase } from './utils/formatters'
import CheckoutModal from './components/cart/CheckoutModal'
import CartDrawerModal from './components/cart/CartDrawerModal'
import { VideoTutorialModal, OrderStepsTutorial, InteractiveMascotTour } from './components/tutorial'
import { AuthModal, EditProfileModal, DeleteAccountModal, ResetPasswordModal } from './components/auth'
import { ProductCard, ProductDetailModal, QuickVariantModal, ImageViewerModal, CatalogHeaderControls, ProductPagination } from './components/product'
import { FilterSidebar, Header, Footer } from './components/layout'
import { HeroBanner } from './components/hero'
import { AutoDemoScreens } from './components/demo'
import { useAutoDemo, useAuth, useCart, useProductGallery, useCatalogFilters } from './hooks'

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
  
  const mainScrollRef = useRef(null)

  // Catalog Filters Hook
  const {
    filtroCategoria,
    setFiltroCategoria,
    ordenamiento,
    setOrdenamiento,
    isSortOpen,
    setIsSortOpen,
    searchTerm,
    setSearchTerm,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    precioMin,
    setPrecioMin,
    precioMax,
    setPrecioMax,
    soloDisponibles,
    setSoloDisponibles,
    soloConImagenes,
    setSoloConImagenes,
    categorySearchTerm,
    setCategorySearchTerm,
    categoryContainerRef,
    paginaActual,
    setPaginaActual,
    itemsVisiblesTodas,
    setItemsVisiblesTodas,
    ITEMS_POR_PAGINA,
    productosVisibles,
    categoriasUnicas,
    categoryCounts,
    productosFiltrados,
    isTodas,
    totalPaginas,
    productosPaginados,
    paginasVisibles,
    scrollCategories
  } = useCatalogFilters({ productos, mainScrollRef })

  // Estado del Tutorial de Compra interactivo
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('hide_catalogo_tutorial') !== 'true';
  })

  // Paso actual del Viaje de Compra guiado (0 = inactivo, 1 a 7 = pasos)
  const [tourStep, setTourStep] = useState(0)
  const [isDialogMinimized, setIsDialogMinimized] = useState(false)
  
  // Estado para el modal del video tutorial
  const [showVideoModal, setShowVideoModal] = useState(false)

  // Auto-restaurar globo al cambiar de paso
  useEffect(() => {
    if (tourStep > 0) {
      setIsDialogMinimized(false)
    }
  }, [tourStep])

  // Selector de variantes/colores
  const [selectedColorByProduct, setSelectedColorByProduct] = useState({})
  const [openColorDropdownId, setOpenColorDropdownId] = useState(null)

  // Referencias para evitar condiciones de carrera en la sincronización del carrito
  const loadingCartFromDb = useRef(false)
  const lastLoadedUid = useRef(null)

  // Auth Hook
  const authState = useAuth({
    setClienteNombre: (val) => cartState.setClienteNombre(val),
    setClienteWhatsapp: (val) => cartState.setClienteWhatsapp(val),
    setCarrito: (val) => cartState.setCarrito(val),
    loadingCartFromDb,
    lastLoadedUid
  })

  // Cart Hook
  const cartState = useCart({
    currentUser: authState.currentUser,
    loadingCartFromDb,
    tourStep,
    setTourStep,
    selectedColorByProduct,
    productos,
    whatsappNumber: WHATSAPP_NUMBER
  })

  const {
    currentUser,
    setCurrentUser,
    userData,
    setUserData,
    showAuthModal,
    setShowAuthModal,
    authTab,
    setAuthTab,
    authForm,
    setAuthForm,
    authError,
    setAuthError,
    authSuccess,
    setAuthSuccess,
    isAuthLoading,
    showProfileMenu,
    setShowProfileMenu,
    showEditProfileModal,
    setShowEditProfileModal,
    editProfileForm,
    setEditProfileForm,
    editProfileError,
    setEditProfileError,
    editProfileSuccess,
    setEditProfileSuccess,
    isEditProfileLoading,
    showDeleteAccountModal,
    setShowDeleteAccountModal,
    deletePassword,
    setDeletePassword,
    deleteAccountError,
    setDeleteAccountError,
    deleteAccountSuccess,
    setDeleteAccountSuccess,
    isDeleteAccountLoading,
    showResetPasswordModal,
    setShowResetPasswordModal,
    resetEmailSuccess,
    setResetEmailSuccess,
    resetEmailError,
    setResetEmailError,
    isResetEmailLoading,
    forgotEmail,
    setForgotEmail,
    handleAuthSubmit,
    handleLogout,
    handleUpdateProfile,
    handleDeleteAccount,
    handleSendResetEmailLoggedIn,
    handleSendResetEmailForgot
  } = authState

  const {
    carrito,
    setCarrito,
    isCartOpen,
    setIsCartOpen,
    filtroCartCategory,
    setFiltroCartCategory,
    showCheckout,
    setShowCheckout,
    clienteNombre,
    setClienteNombre,
    clienteWhatsapp,
    setClienteWhatsapp,
    productParaAñadir,
    setProductParaAñadir,
    varianteSeleccionada,
    setVarianteSeleccionada,
    totalCarrito,
    totalItems,
    categoriasEnCarrito,
    animateFlyToCart,
    abrirModalAñadir,
    añadirAlCarrito,
    actualizarCantidad,
    eliminarDelCarrito,
    prepararCheckout,
    enviarPedidoWhatsApp
  } = cartState

  // Product Gallery Hook
  const {
    productoParaVer,
    setProductoParaVer,
    varianteDetalle,
    setVarianteDetalle,
    animacion,
    setAnimacion,
    indexImagenActual,
    setIndexImagenActual,
    mostrarIndicador,
    setMostrarIndicador,
    mostrarControlesZoom,
    setMostrarControlesZoom,
    expandedImage,
    setExpandedImage,
    isModalImgLoading,
    setIsModalImgLoading,
    modoAntesDespues,
    setModoAntesDespues,
    indexFotoAntes,
    setIndexFotoAntes,
    indexFotoDespues,
    setIndexFotoDespues,
    scale,
    setScale,
    position,
    setPosition,
    fotosProducto,
    anteriorImagen,
    siguienteImagen,
    irAImagen,
    resetZoom,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useProductGallery({ selectedColorByProduct })


  // Auto Demo Hook
  const {
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
  } = useAutoDemo({
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
  })



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
            <CatalogHeaderControls
              filtroCategoria={filtroCategoria}
              isDark={isDark}
              totalProductos={productosFiltrados.length}
              ordenamiento={ordenamiento}
              setOrdenamiento={setOrdenamiento}
              isSortOpen={isSortOpen}
              setIsSortOpen={setIsSortOpen}
            />

            {/* ── TUTORIAL INTERACTIVO DE PASOS PARA PEDIDOS ── */}
            {showTutorial && (
              <OrderStepsTutorial
                isDark={isDark}
                setShowTutorial={setShowTutorial}
                setShowVideoModal={setShowVideoModal}
                setTourStep={setTourStep}
              />
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
            
            {/* ── PAGINACIÓN DEL CATÁLOGO ── */}
            <ProductPagination
              isDark={isDark}
              isTodas={isTodas}
              itemsVisiblesTodas={itemsVisiblesTodas}
              setItemsVisiblesTodas={setItemsVisiblesTodas}
              ITEMS_POR_PAGINA={ITEMS_POR_PAGINA}
              totalProductos={productosFiltrados.length}
              productosPaginadosCount={productosPaginados.length}
              totalPaginas={totalPaginas}
              paginaActual={paginaActual}
              setPaginaActual={setPaginaActual}
              paginasVisibles={paginasVisibles}
              mainScrollRef={mainScrollRef}
            />
          </>
        )}

            {/* FOOTER DEL CATALOGO */}
            <Footer isDark={isDark} />
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


      {/* ── AUTO-DEMO OVERLAYS Y SUBTÍTULOS ── */}
      <AutoDemoScreens
        isDark={isDark}
        isAutoDemo={isAutoDemo}
        showDemoIntro={showDemoIntro}
        showDemoOutro={showDemoOutro}
        outroText={outroText}
        showOutroLeis={showOutroLeis}
        pointerStyle={pointerStyle}
        pointerType={pointerType}
        autoDemoCaption={autoDemoCaption}
        autoDemoProgress={autoDemoProgress}
      />

      {/* ── TOUR GUIADO DE COMPRA CON LA GATITA YOSHITA ── */}
      <InteractiveMascotTour
        tourStep={tourStep}
        setTourStep={setTourStep}
        isDialogMinimized={isDialogMinimized}
        setIsDialogMinimized={setIsDialogMinimized}
        isDark={isDark}
      />


    </div>
  )
}
