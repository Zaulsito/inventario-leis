import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './apps/admin/src/config/firebase.js';

async function checkRecentProducts() {
  try {
    const q = query(collection(db, 'productos'), orderBy('fechaIngreso', 'desc'), limit(10));
    const querySnapshot = await getDocs(q);
    console.log('Recent Products:');
    querySnapshot.forEach((doc) => {
      console.log(`${doc.id} => ${JSON.stringify(doc.data())}`);
    });
  } catch (error) {
    console.error('Error fetching products:', error);
  }
  process.exit();
}

checkRecentProducts();
