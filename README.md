# Inventory App — PWA

Control de inventario con conteo semanal. React + Vite + Tailwind CSS + PWA.

## Stack
- React 18 + React Router 6
- Vite 5
- Tailwind CSS 3
- vite-plugin-pwa (Service Worker + manifest)
- Firebase (próximamente)

## Instalación local

```bash
npm install
npm run dev
```

## Build para producción

```bash
npm run build
```

## Deploy en Vercel

1. Subir el repo a GitHub
2. Conectar en vercel.com → "Import Git Repository"
3. Framework: **Vite** (Vercel lo detecta automático)
4. Build command: `npm run build`
5. Output directory: `dist`
6. Deploy ✅

## Estructura de páginas

| Ruta           | Página        | Descripción                              |
|----------------|---------------|------------------------------------------|
| `/dashboard`   | Dashboard     | Métricas, gráfico, alertas, ingresos     |
| `/inventario`  | Inventario    | Tabla maestra de productos con búsqueda  |
| `/registro`    | Registro      | Formulario de ingreso + historial        |
| `/reportes`    | Reportes      | Informe semanal + conteo editable        |

## Estructura Firestore (próximo paso)

```
/productos/{id}
  nombre, sku, coleccion, unidad, stockMinimo, fechaCreacion

/ingresos/{id}
  productoId, cantidad, fecha, proveedor, nota, creadoPor

/conteosSemana/{id}
  productoId, semana (ej. "2026-W15"), cantidadVendida, stockInicial, stockFinal, fecha
```

## Próximos pasos
- [ ] Conectar Firebase Auth (login)
- [ ] Conectar Firestore (reemplazar datos de ejemplo)
- [ ] Subir iconos PWA reales a /public/icons/
- [ ] Agregar módulo de proveedores
