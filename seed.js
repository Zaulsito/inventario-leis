import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

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

const productosIniciales = [
  { nombre: 'Aceite de Oro Rosa',          sku: 'INV-001', coleccion: 'Premium',  stock: 428,  precio: 85,   estado: 'disponible' },
  { nombre: 'Sérum Regenerador Nocturno',   sku: 'INV-014', coleccion: 'Premium',  stock: 8,    precio: 120,  estado: 'bajo' },
  { nombre: 'Crema Hidratante Esencial',    sku: 'INV-089', coleccion: 'Esencial', stock: 1120, precio: 45,   estado: 'disponible' },
  { nombre: 'Tónico Esencial Rosas',        sku: 'INV-022', coleccion: 'Esencial', stock: 24,   precio: 38,   estado: 'bajo' },
  { nombre: 'Bálsamo Labial Heritage',      sku: 'INV-044', coleccion: 'Premium',  stock: 5,    precio: 25,   estado: 'critico' },
  { nombre: 'Mascarilla Renovadora',        sku: 'INV-067', coleccion: 'Esencial', stock: 92,   precio: 55,   estado: 'disponible' },
  { nombre: 'Agua Micelar Purificante',     sku: 'INV-033', coleccion: 'Base',     stock: 310,  precio: 22,   estado: 'disponible' },
];

async function seed() {
  console.log("Iniciando inyección de datos de prueba en Firestore...");
  try {
    for (const prod of productosIniciales) {
      await addDoc(collection(db, 'productos'), prod);
      console.log(`Producto "${prod.nombre}" añadido.`);
    }
    console.log("¡Datos sembrados con éxito!");
  } catch (error) {
    console.error("Error sembrando datos:", error);
  }
}

seed();
