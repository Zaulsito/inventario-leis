import { useState, useEffect, useRef } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendEmailVerification,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { mergeCarts } from '../utils/cart'

export function useAuth({
  setClienteNombre,
  setClienteWhatsapp,
  setCarrito,
  loadingCartFromDb,
  lastLoadedUid
}) {
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

  const isRegistering = useRef(false)

  // Listener del estado de autenticación de Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified) {
        if (!isRegistering.current) {
          await signOut(auth)
          setCurrentUser(null)
          setUserData(null)
          setCarrito([])
          if (lastLoadedUid) lastLoadedUid.current = null
          if (loadingCartFromDb) loadingCartFromDb.current = false
          return
        }
      }

      setCurrentUser(user)
      if (user) {
        if (lastLoadedUid && lastLoadedUid.current !== user.uid) {
          if (loadingCartFromDb) loadingCartFromDb.current = true
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
            if (setClienteNombre) setClienteNombre(user.displayName || '')
            if (setClienteWhatsapp) setClienteWhatsapp(data.whatsapp || '')
            dbCart = data.carrito || []
          } else {
            if (setClienteNombre) setClienteNombre(user.displayName || '')
          }
          
          if (setCarrito) {
            setCarrito(prev => {
              const merged = mergeCarts(prev, dbCart)
              localStorage.setItem('carritoLeis', JSON.stringify(merged))
              if (loadingCartFromDb) loadingCartFromDb.current = false
              return merged
            })
          }
        } catch (e) {
          console.error("Error cargando perfil", e)
          if (loadingCartFromDb) loadingCartFromDb.current = false
        }
      } else {
        setUserData(null)
        if (setClienteNombre) setClienteNombre('')
        if (setClienteWhatsapp) setClienteWhatsapp('')
        if (setCarrito) setCarrito([])
        if (lastLoadedUid) lastLoadedUid.current = null
        if (loadingCartFromDb) loadingCartFromDb.current = false
      }
    })
    return unsub
  }, [setClienteNombre, setClienteWhatsapp, setCarrito, loadingCartFromDb, lastLoadedUid])

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
      if (setClienteNombre) setClienteNombre(newNombre)
      if (setClienteWhatsapp) setClienteWhatsapp(newWhatsapp)

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
      if (setCarrito) setCarrito([])
      localStorage.removeItem('carritoLeis')
      setCurrentUser(null)
      setUserData(null)
      if (setClienteNombre) setClienteNombre('')
      if (setClienteWhatsapp) setClienteWhatsapp('')
      if (lastLoadedUid) lastLoadedUid.current = null
      if (loadingCartFromDb) loadingCartFromDb.current = false
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

  return {
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
  }
}
