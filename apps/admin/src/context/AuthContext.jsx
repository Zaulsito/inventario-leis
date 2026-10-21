import { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../config/firebase";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  function signup(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    let unsubProfile = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        unsubProfile = onSnapshot(
          doc(db, "usuarios", user.uid),
          (snapshot) => {
            if (snapshot.exists()) {
              setUserProfile(snapshot.data());
            } else {
              setUserProfile(null);
            }
          },
          (err) => {
            console.error("Error al escuchar perfil de usuario:", err);
            setUserProfile(null);
          }
        );
      } else {
        if (unsubProfile) unsubProfile();
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const operatorName = 
    userProfile?.nombre?.trim() || 
    userProfile?.username?.trim() || 
    currentUser?.displayName?.trim() || 
    (currentUser?.email ? currentUser.email.split('@')[0] : '') || 
    'Por sistema';

  const value = {
    currentUser,
    userProfile,
    operatorName,
    signup,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
