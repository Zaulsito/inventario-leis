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

    // Obtener el color del primer píxel (esquina superior izquierda) como color de fondo
    const targetR = data[0];
    const targetG = data[1];
    const targetB = data[2];
    console.log(`Color de fondo detectado (RGB): ${targetR}, ${targetG}, ${targetB}`);

    // Crear un nuevo buffer para RGBA (4 canales)
    const outputBuffer = Buffer.alloc(width * height * 4);

    // Tolerancia para la detección del color de fondo
    const tolerance = 25;

    // --- BORRAR LOGO GEMINI ---
    // Borramos el área de la esquina inferior derecha (60x60 píxeles) antes de procesar
    const logoMargin = 60;

    // --- ALGORITMO FLOOD-FILL (BREADTH-FIRST SEARCH) ---
    // Encontramos todos los píxeles de fondo conectados al borde exterior de la imagen.
    const visited = new Uint8Array(width * height);
    const queue = [];

    function checkAndEnqueue(x, y) {
      if (x < 0 || x >= width || y < 0 || y >= height) return;
      const idx = y * width + x;
      if (visited[idx]) return;

      // Si cae dentro de la esquina del logo de Gemini, lo marcamos directamente como fondo
      if (x > width - logoMargin && y > height - logoMargin) {
        visited[idx] = 1;
        queue.push(idx);
        return;
      }

      const srcIdx = idx * channels;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      const diff = Math.sqrt(
        Math.pow(r - targetR, 2) +
        Math.pow(g - targetG, 2) +
        Math.pow(b - targetB, 2)
      );

      if (diff < tolerance) {
        visited[idx] = 1;
        queue.push(idx);
      }
    }

    // Inicializar cola con todos los píxeles de los 4 bordes exteriores
    for (let x = 0; x < width; x++) {
      checkAndEnqueue(x, 0);
      checkAndEnqueue(x, height - 1);
    }
    for (let y = 0; y < height; y++) {
      checkAndEnqueue(0, y);
      checkAndEnqueue(width - 1, y);
    }

    // Ejecutar BFS para expandir la máscara de fondo
    console.log("Iniciando inundación de fondo (Flood-Fill)...");
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const x = idx % width;
      const y = Math.floor(idx / width);

      // 4 Vecinos
      checkAndEnqueue(x + 1, y);
      checkAndEnqueue(x - 1, y);
      checkAndEnqueue(x, y + 1);
      checkAndEnqueue(x, y - 1);
    }
    console.log(`Inundación completada. Píxeles de fondo identificados: ${queue.length}`);

    // --- APLICAR MÁSCARA TRANSPARENTE ---
    for (let i = 0; i < width * height; i++) {
      const srcIdx = i * channels;
      const destIdx = i * 4;

      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];
      const a = channels === 4 ? data[srcIdx + 3] : 255;

      const x = i % width;
      const y = Math.floor(i / width);

      // Si el píxel fue visitado como parte del fondo exterior, hacerlo transparente
      // O si está dentro del recuadro del logo Gemini, hacerlo transparente
      if (visited[i] === 1 || (x > width - logoMargin && y > height - logoMargin)) {
        outputBuffer[destIdx] = 0;
        outputBuffer[destIdx + 1] = 0;
        outputBuffer[destIdx + 2] = 0;
        outputBuffer[destIdx + 3] = 0;
      } else {
        // Mantener color y opacidad 100% (gato completamente sólido por dentro)
        outputBuffer[destIdx] = r;
        outputBuffer[destIdx + 1] = g;
        outputBuffer[destIdx + 2] = b;
        outputBuffer[destIdx + 3] = 255; // Forzar 255 para evitar áreas semitransparentes en el pelo
      }
    }

    // 3. Crear una nueva imagen Sharp y recortar
    await sharp(outputBuffer, {
      raw: {
        width,
        height,
        channels: 4
      }
    })
    .trim() // Recorta los bordes transparentes sobrantes
    .png()
    .toFile(outputPath + '.temp');

    // Reemplazar la imagen original
    fs.unlinkSync(outputPath);
    fs.renameSync(outputPath + '.temp', outputPath);

    console.log("¡Yoshita procesada con éxito! Sin fondo, sin logo Gemini y 100% sólida.");
  } catch (error) {
    console.error("Error al procesar la imagen de Yoshita:", error);
  }
}

removeBackground();
