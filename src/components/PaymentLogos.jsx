import React from 'react';

/**
 * Logos Vectoriales Oficiales de Pasarelas de Pago Colombianas:
 * Nequi, DaviPlata y Dale!
 * Optimizados con SVG de alta definición, ultraligeros y escalables.
 */

export function NequiLogo({ className = "w-6 h-6", showText = true, textColor = "text-white" }) {
  return (
    <div className="inline-flex items-center gap-2 select-none">
      {/* Icono Nequi */}
      <svg
        viewBox="0 0 100 100"
        className={`${className} shrink-0 drop-shadow-sm`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="24" fill="#200020" />
        {/* N estilizada de Nequi con barra magenta y cian */}
        <path
          d="M28 28V72"
          stroke="#FF007A"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M28 32L68 68"
          stroke="#FF007A"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M68 28V72"
          stroke="#FF007A"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Punto característico cian de Nequi */}
        <circle cx="78" cy="24" r="7" fill="#00D2C4" />
      </svg>
      {showText && (
        <span className={`font-black tracking-tight text-sm ${textColor}`}>
          nequi
        </span>
      )}
    </div>
  );
}

export function DaviPlataLogo({ className = "w-6 h-6", showText = true, textColor = "text-white" }) {
  return (
    <div className="inline-flex items-center gap-2 select-none">
      {/* Icono DaviPlata (Casita Roja estilizada) */}
      <svg
        viewBox="0 0 100 100"
        className={`${className} shrink-0 drop-shadow-sm`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="24" fill="#ED1C24" />
        {/* Techo y silueta casita blanca */}
        <path
          d="M50 22L24 44V74C24 76.2 25.8 78 28 78H72C74.2 78 76 76.2 76 74V44L50 22Z"
          fill="#FFFFFF"
        />
        {/* Puerta/ventana roja interior con moneda amarilla */}
        <rect x="42" y="52" width="16" height="26" rx="4" fill="#ED1C24" />
        <circle cx="50" cy="38" r="6" fill="#FFCC00" />
      </svg>
      {showText && (
        <span className={`font-black tracking-tight text-sm ${textColor}`}>
          Davi<span className="text-[#FFCC00]">Plata</span>
        </span>
      )}
    </div>
  );
}

export function DaleLogo({ className = "w-6 h-6", showText = true, textColor = "text-white" }) {
  return (
    <div className="inline-flex items-center gap-2 select-none">
      {/* Icono Dale! de Grupo Aval */}
      <svg
        viewBox="0 0 100 100"
        className={`${className} shrink-0 drop-shadow-sm`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="100" height="100" rx="24" fill="#FFDD00" />
        {/* Sonrisa y exclamación Dale! en negro */}
        <circle cx="36" cy="40" r="7" fill="#000000" />
        <circle cx="64" cy="40" r="7" fill="#000000" />
        {/* Sonrisa amplia */}
        <path
          d="M32 58C36 68 64 68 68 58"
          stroke="#000000"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span className={`font-black tracking-tight text-sm ${textColor}`}>
          dale<span className="text-[#FFDD00]">!</span>
        </span>
      )}
    </div>
  );
}

/**
 * Tarjeta interactiva de Billetera Digital con diseño corporativo
 */
export function WalletAccountCard({ walletType, number, holderName = "Sebastian Garcés", onCopy, copiedKey }) {
  const isNequi = walletType === 'nequi';
  const isDaviplata = walletType === 'daviplata';
  const isDale = walletType === 'dale';

  const config = {
    nequi: {
      name: 'Nequi',
      badge: 'Billetera Digital Bancolombia',
      gradient: 'from-[#2a0833] via-[#1a0520] to-[#0d0210]',
      border: 'border-[#ff007a]/40 hover:border-[#ff007a]',
      accent: 'text-[#ff007a]',
      glow: 'shadow-[0_8px_30px_rgba(255,0,122,0.15)]',
      label: 'Número de Celular:',
      value: number || '324 472 5167',
      copyValue: '3244725167',
      logo: <NequiLogo className="w-8 h-8" showText={true} />
    },
    daviplata: {
      name: 'DaviPlata',
      badge: 'Billetera Digital Davivienda',
      gradient: 'from-[#3a0a0d] via-[#220406] to-[#120203]',
      border: 'border-[#ed1c24]/40 hover:border-[#ed1c24]',
      accent: 'text-[#ed1c24]',
      glow: 'shadow-[0_8px_30px_rgba(237,28,36,0.15)]',
      label: 'Llave Transfiya / Celular:',
      value: number || '@PLATA3244725167 (o cel 3244725167)',
      copyValue: '@PLATA3244725167',
      logo: <DaviPlataLogo className="w-8 h-8" showText={true} />
    },
    dale: {
      name: 'Dale!',
      badge: 'Billetera Digital Grupo Aval',
      gradient: 'from-[#332b00] via-[#1f1a00] to-[#0f0d00]',
      border: 'border-[#ffdd00]/40 hover:border-[#ffdd00]',
      accent: 'text-[#ffdd00]',
      glow: 'shadow-[0_8px_30px_rgba(255,221,0,0.15)]',
      label: 'Llave Transfiya / Celular:',
      value: number || '@SGG04 (o cel 3244725167)',
      copyValue: '@SGG04',
      logo: <DaleLogo className="w-8 h-8" showText={true} />
    }
  }[walletType] || {
    name: 'Billetera',
    badge: 'Pago Digital',
    gradient: 'from-stone-900 to-stone-950',
    border: 'border-stone-800',
    accent: 'text-stone-300',
    glow: '',
    label: 'Dato:',
    value: number,
    copyValue: number,
    logo: null
  };

  const isCopied = copiedKey === walletType;

  return (
    <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 border bg-gradient-to-b ${config.gradient} ${config.border} ${config.glow} transition-all duration-300 flex flex-col justify-between group`}>
      {/* Resplandor superior */}
      <div className="flex items-start justify-between gap-3 mb-3">
        {config.logo}
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-stone-300">
          Activo ✓
        </span>
      </div>

      <div className="space-y-1 mb-4">
        <span className="text-[10px] text-stone-400 uppercase font-semibold tracking-wider block">
          {config.label}
        </span>
        <div className="text-base sm:text-lg font-black text-white font-mono tracking-tight select-all">
          {config.value}
        </div>
        <p className="text-[11px] text-stone-400">
          Titular: <strong className="text-stone-200">{holderName}</strong>
        </p>
      </div>

      <button
        type="button"
        onClick={() => onCopy && onCopy(config.copyValue, walletType)}
        className="w-full py-2.5 px-3 rounded-xl bg-black/50 hover:bg-black/80 border border-white/10 hover:border-white/30 text-xs font-bold text-stone-200 flex items-center justify-center gap-2 active:scale-95 transition-all"
      >
        {isCopied ? (
          <span className="text-emerald-400 font-extrabold flex items-center gap-1">
            ✓ ¡Copiado al Portapapeles!
          </span>
        ) : (
          <span>📋 Copiar Dato de Pago</span>
        )}
      </button>
    </div>
  );
}
