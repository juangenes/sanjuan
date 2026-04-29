import { createContext, useContext, useState } from 'react';

const CarritoCtx = createContext();

export function CarritoProvider({ children }) {
  const [items, setItems] = useState([]);

  function agregar(producto) {
    setItems(prev => {
      const existe = prev.find(i => i.idproducto === producto.idproducto);
      if (existe) {
        if (existe.cantidad >= producto.stock) return prev;
        return prev.map(i =>
          i.idproducto === producto.idproducto ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      if (producto.stock < 1) return prev;
      return [...prev, { ...producto, cantidad: 1 }];
    });
  }

  function quitar(idproducto) {
    setItems(prev => {
      const item = prev.find(i => i.idproducto === idproducto);
      if (!item) return prev;
      if (item.cantidad === 1) return prev.filter(i => i.idproducto !== idproducto);
      return prev.map(i => i.idproducto === idproducto ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  }

  function limpiar() { setItems([]); }

  const total = items.reduce((acc, i) => acc + i.precio_preventa * i.cantidad, 0);
  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <CarritoCtx.Provider value={{ items, agregar, quitar, limpiar, total, cantidadTotal }}>
      {children}
    </CarritoCtx.Provider>
  );
}

export const useCarrito = () => useContext(CarritoCtx);
