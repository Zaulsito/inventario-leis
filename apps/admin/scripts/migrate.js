import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAWq52Plzd03C_71Is7GE6spgBrbhV6yko",
  authDomain: "inventory-app-d06bb.firebaseapp.com",
  projectId: "inventory-app-d06bb",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CLOUD_NAME = 'eumyiqcl';
const UPLOAD_PRESET = 'Mileis';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const urlMap = new Map();

async function uploadBufferToCloudinary(buffer, originalUrl) {
  const form = new FormData();
  const ext = originalUrl.endsWith('.png') ? 'png' : 'jpg';
  const blob = new Blob([buffer], { type: ext === 'png' ? 'image/png' : 'image/jpeg' });
  form.append('file', blob, `image.${ext}`);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: form
  });

  const data = await res.json();
  if (data.secure_url) {
    return data.secure_url;
  }
  throw new Error(data.error?.message || 'Error al subir a Cloudinary');
}

async function migrateSingleUrl(url, prodNombre) {
  if (!url || typeof url !== 'string') return url;
  if (url.includes('cloudinary.com')) return url;
  if (!url.includes('ibb.co')) return url;

  if (urlMap.has(url)) {
    return urlMap.get(url);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    // 1. Protección de estado HTTP
    if (res.status !== 200) {
      console.warn(`[OMITIDA - STATUS ${res.status}] ${prodNombre} (${url})`);
      return url;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Protección Anti-Error de ImgBB (la tarjeta azul pesa ~3.5 KB)
    if (buffer.length < 5500) {
      console.warn(`[OMITIDA - TAMAÑO ERROR IMGBB ${buffer.length} bytes] ${prodNombre} (${url})`);
      return url;
    }

    // 3. Subir a Cloudinary
    const newUrl = await uploadBufferToCloudinary(buffer, url);
    urlMap.set(url, newUrl);
    console.log(`[MIGRADA OK] ${prodNombre} -> ${newUrl}`);
    return newUrl;

  } catch (err) {
    console.warn(`[OMITIDA - CONEXION] ${prodNombre}: ${err.message}`);
    return url;
  }
}

async function main() {
  console.log('=== INICIANDO MIGRACIÓN SEGURA A CLOUDINARY ===');

  // Paso 1: Respaldo previo
  const snap = await getDocs(collection(db, 'productos'));
  const backupData = [];
  snap.forEach(d => backupData.push({ id: d.id, ...d.data() }));

  const dateStr = new Date().toISOString().split('T')[0];
  const backupFileName = `backup_pre_cloudinary_${dateStr}.json`;
  fs.writeFileSync(backupFileName, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`[RESPALDO CREADO] ${backupData.length} productos respaldados en ${backupFileName}`);

  let productosActualizados = 0;
  let totalFotosMigradas = 0;
  let totalFotosOmitidas = 0;

  for (let i = 0; i < backupData.length; i++) {
    const prod = backupData[i];
    let huboCambio = false;

    // Foto Principal
    let newFotoUrl = prod.fotoUrl;
    if (prod.fotoUrl && prod.fotoUrl.includes('ibb.co')) {
      newFotoUrl = await migrateSingleUrl(prod.fotoUrl, prod.nombre);
      if (newFotoUrl !== prod.fotoUrl) {
        huboCambio = true;
        totalFotosMigradas++;
      } else {
        totalFotosOmitidas++;
      }
    }

    // Galería de Fotos
    let newFotos = Array.isArray(prod.fotos) ? [...prod.fotos] : [];
    for (let fIdx = 0; fIdx < newFotos.length; fIdx++) {
      const fUrl = newFotos[fIdx];
      if (fUrl && fUrl.includes('ibb.co')) {
        const mig = await migrateSingleUrl(fUrl, prod.nombre);
        if (mig !== fUrl) {
          newFotos[fIdx] = mig;
          huboCambio = true;
          totalFotosMigradas++;
        } else {
          totalFotosOmitidas++;
        }
      }
    }

    // Variantes
    let newVariantes = Array.isArray(prod.variantes) ? [...prod.variantes] : [];
    for (let vIdx = 0; vIdx < newVariantes.length; vIdx++) {
      const v = { ...newVariantes[vIdx] };
      let vChanged = false;

      if (v.fotoUrl && v.fotoUrl.includes('ibb.co')) {
        const mig = await migrateSingleUrl(v.fotoUrl, `${prod.nombre} (${v.nombre})`);
        if (mig !== v.fotoUrl) {
          v.fotoUrl = mig;
          vChanged = true;
          totalFotosMigradas++;
        } else {
          totalFotosOmitidas++;
        }
      }

      if (Array.isArray(v.fotos)) {
        const vFotos = [...v.fotos];
        for (let vfIdx = 0; vfIdx < vFotos.length; vfIdx++) {
          const vfUrl = vFotos[vfIdx];
          if (vfUrl && vfUrl.includes('ibb.co')) {
            const mig = await migrateSingleUrl(vfUrl, `${prod.nombre} (${v.nombre})`);
            if (mig !== vfUrl) {
              vFotos[vfIdx] = mig;
              vChanged = true;
              totalFotosMigradas++;
            } else {
              totalFotosOmitidas++;
            }
          }
        }
        if (vChanged) v.fotos = vFotos;
      }

      if (vChanged) {
        newVariantes[vIdx] = v;
        huboCambio = true;
      }
    }

    // Actualizar en Firestore si hubo fotos migradas
    if (huboCambio) {
      await updateDoc(doc(db, 'productos', prod.id), {
        fotoUrl: newFotoUrl || '',
        fotos: newFotos,
        variantes: newVariantes
      });
      productosActualizados++;
    }

    console.log(`[${i + 1}/${backupData.length}] Procesado: ${prod.nombre}`);
  }

  console.log('\n=== REPORTE FINAL DE MIGRACIÓN ===');
  console.log(`Productos actualizados en base de datos: ${productosActualizados}`);
  console.log(`Fotos migradas exitosamente a Cloudinary: ${totalFotosMigradas}`);
  console.log(`Fotos omitidas (por estar caídas en ImgBB): ${totalFotosOmitidas}`);
  console.log(`Archivo de respaldo seguro: ${backupFileName}`);
  process.exit(0);
}

main().catch(err => {
  console.error("Error fatal en migración:", err);
  process.exit(1);
});
