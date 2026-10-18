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
} = {}) {
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

  // Mantener referencias estables de los callbacks para evitar re-suscripciones innecesarias
  const callbacksRef = useRef({ setClienteNombre, setClienteWhatsapp, setCarrito })
  useEffect(() => {
    callbacksRef.current = { setClienteNombre, setClienteWhatsapp, setCarrito }
  })

  // Listener del estado de autenticación de Firebase (se suscribe una sola vez en el montaje)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified) {
        if (!isRegistering.current) {
          await signOut(auth)
          setCurrentUser(null)
          setUserData(null)
          callbacksRef.current.setCarrito?.([])
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
            callbacksRef.current.setClienteNombre?.(user.displayName || '')
            callbacksRef.current.setClienteWhatsapp?.(data.whatsapp || '')
            dbCart = data.carrito || []
          } else {
            callbacksRef.current.setClienteNombre?.(user.displayName || '')
          }
          
          if (callbacksRef.current.setCarrito) {
            callbacksRef.current.setCarrito(prev => {
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
        callbacksRef.current.setClienteNombre?.('')
        callbacksRef.current.setClienteWhatsapp?.('')
        if (lastLoadedUid) lastLoadedUid.current = null
        if (loadingCartFromDb) loadingCartFromDb.current = false
      }
    })
    return unsub
  }, []) // Solo se suscribe una vez

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setIsAuthLoading(true)

    try {
      if (authTab === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, authForm.email, authForm.password)
        if (!userCredential.user.emailVerified) {
          await signOut(auth)
          setAuthError('Debes verificar tu correo antes de iniciar sesión. Te hemos enviado un correo de confirmación.')
          setIsAuthLoading(false)
          return
        }
        setShowAuthModal(false)
        setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' })
      } else {
        isRegistering.current = true
        const userCredential = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password)
        await updateProfile(userCredential.user, { displayName: authForm.nombre })
        
        await sendEmailVerification(userCredential.user)
        
        const cleanWhatsapp = (authForm.whatsapp || '').replace(/\D/g, '')
        const fullWhatsapp = cleanWhatsapp ? `+56${cleanWhatsapp}` : ''

        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          nombre: authForm.nombre,
          email: authForm.email,
          whatsapp: fullWhatsapp,
          emailVerified: false,
          createdAt: new Date().toISOString()
        })

        await signOut(auth)
        isRegistering.current = false
        setAuthSuccess('¡Registro casi listo! Te hemos enviado un correo de verificación. Por favor revisa tu bandeja de entrada o spam antes de iniciar sesión.')
        setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' })
      }
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/email-already-in-use') {
        setAuthError('El correo ya está registrado.')
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setAuthError('Correo o contraseña incorrectos.')
      } else if (err.code === 'auth/weak-password') {
        setAuthError('La contraseña debe tener al menos 6 caracteres.')
      } else if (err.code === 'auth/user-not-found') {
        setAuthError('No existe una cuenta con este correo.')
      } else {
        setAuthError('Ocurrió un error. Inténtalo de nuevo.')
      }
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setCurrentUser(null)
      setUserData(null)
      callbacksRef.current.setCarrito?.([])
      localStorage.removeItem('carritoLeis')
      callbacksRef.current.setClienteNombre?.('')
      callbacksRef.current.setClienteWhatsapp?.('')
      setShowProfileMenu(false)
    } catch (err) {
      console.error('Error al cerrar sesión', err)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setEditProfileError('')
    setEditProfileSuccess('')
    setIsEditProfileLoading(true)

    try {
      if (editProfileForm.nombre && editProfileForm.nombre !== currentUser.displayName) {
        await updateProfile(currentUser, { displayName: editProfileForm.nombre })
      }

      const cleanWhatsapp = (editProfileForm.whatsapp || '').replace(/\D/g, '')
      const fullWhatsapp = cleanWhatsapp ? `+56${cleanWhatsapp}` : ''

      await setDoc(doc(db, 'usuarios', currentUser.uid), {
        nombre: editProfileForm.nombre,
        whatsapp: fullWhatsapp
      }, { merge: true })

      setUserData(prev => ({
        ...prev,
        nombre: editProfileForm.nombre,
        whatsapp: fullWhatsapp
      }))
      
      callbacksRef.current.setClienteNombre?.(editProfileForm.nombre)
      callbacksRef.current.setClienteWhatsapp?.(fullWhatsapp)

      setEditProfileSuccess('¡Perfil actualizado con éxito!')
      setTimeout(() => {
        setShowEditProfileModal(false)
        setEditProfileSuccess('')
      }, 1500)
    } catch (err) {
      console.error(err)
      setEditProfileError('Error al actualizar el perfil. Inténtalo de nuevo.')
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
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword)
      await reauthenticateWithCredential(currentUser, credential)

      const uid = currentUser.uid

      const ordenesRef = collection(db, 'ordenes')
      const q = query(ordenesRef, where('clienteUid', '==', uid))
      const querySnapshot = await getDocs(q)
      
      for (const docSnap of querySnapshot.docs) {
        await deleteDoc(doc(db, 'ordenes', docSnap.id))
      }

      await deleteDoc(doc(db, 'usuarios', uid))
      await deleteUser(currentUser)

      setCurrentUser(null)
      setUserData(null)
      callbacksRef.current.setCarrito?.([])
      localStorage.removeItem('carritoLeis')
      callbacksRef.current.setClienteNombre?.('')
      callbacksRef.current.setClienteWhatsapp?.('')

      setDeleteAccountSuccess('Tu cuenta ha sido eliminada exitosamente.')
      setTimeout(() => {
        setShowDeleteAccountModal(false)
        setShowProfileMenu(false)
        setDeletePassword('')
      }, 2000)
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteAccountError('La contraseña ingresada es incorrecta.')
      } else {
        setDeleteAccountError('No se pudo eliminar la cuenta. Inténtalo de nuevo.')
      }
    } finally {
      setIsDeleteAccountLoading(false)
    }
  }

  const handleSendResetEmailLoggedIn = async () => {
    if (!currentUser?.email) return
    setIsResetEmailLoading(true)
    setResetEmailError('')
    setResetEmailSuccess('')

    try {
      await sendPasswordResetEmail(auth, currentUser.email)
      setResetEmailSuccess('Correo de recuperación enviado con éxito.')
    } catch (err) {
      console.error(err)
      setResetEmailError('No se pudo enviar el correo de recuperación.')
    } finally {
      setIsResetEmailLoading(false)
    }
  }

  const handleSendResetEmailForgot = async (e) => {
    e.preventDefault()
    if (!forgotEmail) {
      setResetEmailError('Por favor ingresa tu correo electrónico.')
      return
    }
    setIsResetEmailLoading(true)
    setResetEmailError('')
    setResetEmailSuccess('')

    try {
      await sendPasswordResetEmail(auth, forgotEmail)
      setResetEmailSuccess('Correo de recuperación enviado con éxito. Revisa tu bandeja de entrada o spam.')
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/user-not-found') {
        setResetEmailError('No existe una cuenta con este correo electrónico.')
      } else {
        setResetEmailError('No se pudo enviar el correo. Verifica que esté bien escrito.')
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

export default useAuth
