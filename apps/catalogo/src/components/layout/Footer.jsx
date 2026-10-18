export default function Footer({ isDark }) {
  return (
    <footer className="mt-16 pt-16 pb-12 border-t border-outline-variant/10 dark:border-white/5 flex flex-col items-center gap-4 opacity-50">
      <div className="flex items-center gap-3">
        <span className={`font-headline font-bold text-sm tracking-tight ${isDark ? 'text-white/80' : 'text-on-surface/80'}`}>
          Leis Catálogo V1.5
        </span>
      </div>
      <p className={`text-[10px] font-bold uppercase tracking-[0.3em] text-center ${isDark ? 'text-gray-500' : 'text-outline'}`}>
        "Tu éxito está en nuestros productos"
      </p>
      <div className="flex items-center gap-2 mt-2">
        <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[#e2bd6c]/40' : 'bg-primary/40'}`} />
        <span className={`text-[8px] font-extrabold uppercase tracking-widest text-center ${isDark ? 'text-gray-600' : 'text-outline'}`}>
          © 2026 Todos los derechos reservados
        </span>
        <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[#e2bd6c]/40' : 'bg-primary/40'}`} />
      </div>
    </footer>
  )
}
