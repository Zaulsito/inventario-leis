export const APP_VERSION = '1.5.0';

export const LATEST_CHANGES = [
  {
    title: 'Desglose FIFO por Proveedor 📦',
    description: 'Los pedidos y ventas descuentan stock automáticamente del proveedor más antiguo (FIFO) y desglosan las unidades correspondientes por lote.',
    icon: 'local_shipping'
  },
  {
    title: 'Trazabilidad y Filtros en Kardex 🏢',
    description: 'Visualización clara en el historial con insignias por proveedor (ej. Cruz Verde 1 | Barter 1), estadísticas e historial filtrables por proveedor.',
    icon: 'history'
  },
  {
    title: 'Costos y Margen Dinámicos 💰',
    description: 'El encabezado de auditoría calcula el precio de costo actual y margen de ganancia en tiempo real según el lote activo o proveedor filtrado.',
    icon: 'payments'
  },
  {
    title: 'Precisión Cronológica en Transacciones 🕒',
    description: 'Ordenamiento por marca de tiempo exacta en pedidos y reposiciones para garantizar la coherencia del stock en operaciones del mismo día.',
    icon: 'schedule'
  }
];
