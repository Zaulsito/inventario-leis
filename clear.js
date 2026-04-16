import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAWq52Plzd03C_71Is7GE6spgBrbhV6yko",
  authDomain: "inventory-app-d06bb.firebaseapp.com",
  projectId: "inventory-app-d06bb",
  storageBucket: "inventory-app-d06bb.firebasestorage.app",
  messagingSenderId: "922485515603",
  appId: "1:922485515603:web:c54ffe90e4e2858e71ada6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function truncate() {
  console.log("Limpiando Firetore...");
  const pSnap = await getDocs(collection(db, 'productos'));
  for (const d of pSnap.docs) await deleteDoc(doc(db, 'productos', d.id));
  const mSnap = await getDocs(collection(db, 'movimientos'));
  for (const d of mSnap.docs) await deleteDoc(doc(db, 'movimientos', d.id));
  console.log("Limpieza exitosa.");
}

truncate();
