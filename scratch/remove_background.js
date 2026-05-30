import sharp from 'sharp';
import fs from 'fs';

async function removeBackground() {
  try {
    const inputPath = 'apps/catalogo/public/gatita.png';
    const outputPath = 'apps/catalogo/public/gatita.png';

    // 1. Cargar la imagen y obtener metadatos y buffer raw
    const image = sharp(inputPath);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    
    const width = info.width;
    const height = info.height;
    const channels = info.channels; // Debería ser 3 (RGB) o 4 (RGBA)

    console.log(`Procesando imagen: ${width}x${height}, canales: ${channels}`);

    // 2. Obtener el color del primer píxel (esquina superior izquierda) como color de fondo
    const targetR = data[0];
    const targetG = data[1];
    const targetB = data[2];
    console.log(`Color de fondo detectado (RGB): ${targetR}, ${targetG}, ${targetB}`);

    // Crear un nuevo buffer para RGBA (4 canales)
    const outputBuffer = Buffer.alloc(width * height * 4);

    // Tolerancia para la detección del color de fondo
    const tolerance = 15;

    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * channels;
      const destIdx = i * 4;

      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const a = channels === 4 ? data[srcIdx + 3] : 255;

      // Calcular la diferencia de color (distancia euclidiana)
      const diff = Math.sqrt(
        Math.pow(r - targetR, 2) +
        Math.pow(g - targetG, 2) +
        Math.pow(b - targetB, 2)
      );

      if (diff < tolerance) {
        // Píxel de fondo -> Hacerlo transparente
        outputBuffer[destIdx] = 0;
        outputBuffer[destIdx + 1] = 0;
        outputBuffer[destIdx + 2] = 0;
        outputBuffer[destIdx + 3] = 0;
      } else {
        // Píxel del gato -> Mantener color original
        outputBuffer[destIdx] = r;
        outputBuffer[destIdx + 1] = g;
        outputBuffer[destIdx + 2] = b;
        outputBuffer[destIdx + 3] = a;
      }
    }

    // 3. Crear una nueva imagen Sharp a partir del buffer raw
    // Y usar .trim() para recortar todo el espacio transparente sobrante
    await sharp(outputBuffer, {
      raw: {
        width,
        height,
        channels: 4
      }
    })
    .trim() // Recorta los bordes transparentes
    .png()
    .toFile(outputPath + '.temp');

    // Reemplazar la imagen original con la procesada
    fs.unlinkSync(outputPath);
    fs.renameSync(outputPath + '.temp', outputPath);

    console.log("¡Fondo removido con éxito y recortado!");
  } catch (error) {
    console.error("Error al remover el fondo:", error);
  }
}

removeBackground();
