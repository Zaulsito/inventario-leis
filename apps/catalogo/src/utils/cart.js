export function mergeCarts(localCart, dbCart) {
  const merged = [...(dbCart || [])];
  if (localCart && localCart.length > 0) {
    localCart.forEach(localItem => {
      const existingIdx = merged.findIndex(dbItem => dbItem.idCart === localItem.idCart);
      if (existingIdx > -1) {
        const combinedQty = merged[existingIdx].cantidad + localItem.cantidad;
        merged[existingIdx].cantidad = Math.min(combinedQty, merged[existingIdx].maxStock);
      } else {
        merged.push(localItem);
      }
    });
  }
  return merged;
}
