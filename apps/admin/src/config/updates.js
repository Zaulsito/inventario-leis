export const APP_VERSION = '1.601';
export const RELEASE_DATE = '26 de Octubre, 2026';

export const LATEST_CHANGES = [
  {
    title: 'Asistente de Nuevo Producto en 2 Pasos',
    tag: 'Inventario & Catálogo',
    icon: 'format_list_numbered',
    summary: 'Nuevo flujo guiado y modular para dar de alta o editar artículos sin saturar la pantalla.',
    details: [
      'Paso 1 (Identificación & Variantes): Configuración de nombre, categoría, SKU maestro, precio mayorista, precio al detalle y creación de variantes con sus respectivas imágenes.',
      'Paso 2 (Stock, Costos & Almacén): Asignación directa de unidades por variante, costo unitario de compra y umbrales mínimos de stock.',
      'Validación de avance: El sistema valida que todos los datos primarios y variantes obligatorias estén completos antes de permitir el paso al inventario físico.'
    ]
  },
  {
    title: 'Protección Integral contra Eliminación con Ventas Activas',
    tag: 'Seguridad & Contabilidad',
    icon: 'shield_lock',
    summary: 'Blindaje total del historial contable y trazabilidad de pedidos cerrados y en curso.',
    details: [
      'Detección tridimensional: Comprueba ventas registradas por ID interno de producto, SKU de variante o coincidencia exacta de nombre en todo el historial de pedidos.',
      'Bloqueo preventivo de producto: Impide borrar cualquier producto que tenga pedidos vinculados, ofreciendo la alternativa de ocultarlo del catálogo público.',
      'Protección a nivel de Variante/Color: Impide eliminar un color específico si ya tiene ventas históricas asociadas, preservando la coherencia en reportes y gráficos.'
    ]
  },
  {
    title: 'Validación Estricta de Variantes con Auto-Enfoque y Halo Carmesí',
    tag: 'Validación & UX',
    icon: 'ads_click',
    summary: 'Garantía de que ninguna variante quede sin nombre o identificación en el sistema.',
    details: [
      'Alerta interactiva y auto-scroll: Si una variante queda vacía o con nombre por defecto, la pantalla se desplaza automáticamente hacia el campo faltante.',
      'Halo carmesí temporizado: El campo sin completar se ilumina en rojo vibrante durante 3 segundos con efecto de foco para localizarlo de un vistazo.',
      'Notificación flotante superior: Banner explicativo con mensaje claro que informa el motivo de la detención antes de guardar o cambiar de paso.'
    ]
  },
  {
    title: 'Gestión Táctil de Fotos, Orden y Visibilidad de Colores',
    tag: 'Multimedia & Tienda',
    icon: 'palette',
    summary: 'Herramientas táctiles ágiles pensadas para teléfonos y tablets en bodega.',
    details: [
      'Eliminación por pulsación prolongada (Long-Press): Para prevenir toques accidentales en pantallas táctiles, las fotos de variantes se eliminan manteniendo pulsado durante 1.5 segundos con confirmación háptica.',
      'Visor a pantalla completa y reordenamiento: Inspección rápida en alta resolución y botones directos para mover fotos hacia adelante o atrás.',
      'Switch de visibilidad por color: Posibilidad de ocultar colores agotados en el catálogo público manteniendo intacto el stock y la ficha interna.'
    ]
  },
  {
    title: 'Selector Rápido de Variantes y Chips Compactos en Pedidos',
    tag: 'Punto de Venta (POS)',
    icon: 'touch_app',
    summary: 'Optimización del espacio de trabajo al registrar ventas y despachos en pantalla móvil.',
    details: [
      'Auto-elevación del buscador: Al pulsar en el buscador de productos, la vista se alinea hacia arriba para evitar que el teclado virtual tape las opciones.',
      'Chips de colores compactos y sin desbordes: Los selectores de variantes se adaptan a formato chip horizontal ergonómico, evitando que los nombres largos queden cortados o desalineados.',
      'Selección de stock en tiempo real: Actualización inmediata de cantidades disponibles por cada color al armar la comanda de venta.'
    ]
  },
  {
    title: 'Dashboard Simétrico, KPIs Adaptativos y Modo Oscuro Luxe',
    tag: 'Diseño & Métricas',
    icon: 'dark_mode',
    summary: 'Consistencia visual prémium y lectura rápida del rendimiento del negocio.',
    details: [
      'Cuadrícula KPI 2x2 equilibrada: Tarjeta panorámica destacada de "Valor Total Inventario" y 4 indicadores secundarios perfectamente simétricos en móvil y escritorio.',
      'Modo colapsable en móvil: Opción para replegar los paneles métricos en pantallas pequeñas y dar máxima prioridad a la lista de productos o ventas.',
      'Refinamiento Luxe Dark: Ajuste de contraste en botones de acción rápida (editar/eliminar) y paleta dorada optimizada para jornadas nocturnas.'
    ]
  }
];
