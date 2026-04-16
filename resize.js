import fs from 'fs';
import sharp from 'sharp';

if (!fs.existsSync('./public/icons')) {
  fs.mkdirSync('./public/icons', { recursive: true });
}

async function resize() {
  try {
    await sharp('logo.jpeg').resize(192, 192).toFile('./public/icons/icon-192.png');
    console.log("Generado icon-192.png");
    
    await sharp('logo.jpeg').resize(512, 512).toFile('./public/icons/icon-512.png');
    console.log("Generado icon-512.png");
  } catch (error) {
    console.error("Error al procesar la imagen:", error);
  }
}

resize();
