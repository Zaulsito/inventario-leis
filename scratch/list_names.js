import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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

async function listAllNames() {
  try {
    const allSnapshot = await getDocs(collection(db, 'productos'));
    const names = [];
    allSnapshot.forEach(doc => {
        names.push(doc.data().nombre);
    });
    console.log(JSON.stringify(names.sort()));
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit();
}

listAllNames();
