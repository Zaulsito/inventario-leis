import React from 'react'

export default function Footer() {
  return (
    <footer className="mt-auto pt-16 pb-12 border-t border-outline-variant/10 dark:border-white/5 flex flex-col items-center gap-4 opacity-50">
      <div className="flex items-center gap-3">
        <span className="font-headline font-bold text-sm tracking-tight dark:text-white/80">Leis Administración V1.2</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-outline dark:text-gray-500">
        "Tu éxito está en nuestros productos"
      </p>
      <div className="flex items-center gap-2 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 dark:bg-[#e2bd6c]/40" />
        <span className="text-[8px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-600">© 2026 Todos los derechos reservados</span>
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 dark:bg-[#e2bd6c]/40" />
      </div>
    </footer>
  )
}
