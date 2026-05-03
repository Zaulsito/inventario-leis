import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";

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

async function checkRecentProducts() {
  try {
    const q = query(collection(db, 'productos'), orderBy('fechaIngreso', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);
    console.log('Recent Products (by fechaIngreso):');
    querySnapshot.forEach((doc) => {
      console.log(`${doc.id} => ${doc.data().nombre} (${doc.data().fechaIngreso})`);
    });
    
    // Also check by document creation (if possible, but Firestore doesn't have it by default unless we add it)
    // Let's just list all products and look for ones without names or weird names
    const allSnapshot = await getDocs(collection(db, 'productos'));
    console.log('\nAll Products Count:', allSnapshot.size);
    
  } catch (error) {
    console.error('Error fetching products:', error);
  }
  process.exit();
}

checkRecentProducts();
