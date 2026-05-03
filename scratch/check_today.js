import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

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

async function checkTodayProducts() {
  try {
    const today = '2026-05-03';
    console.log(`Checking products with fechaIngreso = ${today}`);
    const q = query(collection(db, 'productos'), where('fechaIngreso', '==', today));
    const querySnapshot = await getDocs(q);
    console.log('Products found:', querySnapshot.size);
    querySnapshot.forEach((doc) => {
      console.log(`${doc.id} => ${doc.data().nombre} (${doc.data().fechaIngreso})`);
    });
    
    // Also check for products added today in ISO format or something else
    const allSnapshot = await getDocs(collection(db, 'productos'));
    console.log('\nChecking all products for anything unusual...');
    allSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.fechaIngreso && data.fechaIngreso.includes('2026-05-03')) {
            console.log('Found with partial match:', doc.id, data.nombre, data.fechaIngreso);
        }
    });

  } catch (error) {
    console.error('Error fetching products:', error);
  }
  process.exit();
}

checkTodayProducts();
