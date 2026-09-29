import React from 'react';

interface JetCyberLogoProps {
  className?: string;
  variant?: 'icon' | 'horizontal' | 'vertical';
  size?: number | string;
  theme?: 'dark' | 'light';
}

export const JetCyberLogo: React.FC<JetCyberLogoProps> = ({
  className = '',
  variant = 'horizontal',
  size,
  theme = 'light'
}) => {
  const isLight = theme === 'light';
  const textColor = isLight ? '#0F172A' : '#0F172A';
  const subTextColor = isLight ? '#64748B' : '#64748B';
  const strandStroke = '#0F172A';
  const strandNodeBorder = '#0F172A';

  // Standalone Icon SVG: Tight viewBox (38 52 360 298) eliminates dead margins
  // and makes the globe & fiber optics significantly larger and bolder!
  const renderIcon = (iconSize: number | string = 60) => (
    <svg
      viewBox="38 52 360 298"
      width={iconSize}
      height={typeof iconSize === 'number' ? Math.round(iconSize * (298 / 360)) : iconSize}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform"
    >
      <defs>
        {/* Globe Radial Gradient */}
        <radialGradient id="jcnGlobeGrad" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="35%" stopColor="#1D68FE" />
          <stop offset="85%" stopColor="#0B40C4" />
          <stop offset="100%" stopColor="#072B8C" />
        </radialGradient>

        {/* Cable Outer Jacket Gradient */}
        <linearGradient id="jcnCableGrad" x1="120" y1="360" x2="360" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0A1124" />
          <stop offset="50%" stopColor="#102042" />
          <stop offset="100%" stopColor="#081020" />
        </linearGradient>

        {/* Cable Rim Collar Highlight */}
        <linearGradient id="jcnCollarGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#CBD5E1" />
          <stop offset="50%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>

        {/* Cable Core Face */}
        <radialGradient id="jcnCoreFace" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="80%" stopColor="#090E17" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
      </defs>

      {/* --- 1. Top-Right Fiber Optic Strands (from Upper Cable Cut) --- */}
      <g stroke={strandStroke} strokeWidth="3.4" strokeLinecap="round">
        {/* Strand 1 (Longest outer) */}
        <line x1="330" y1="100" x2="354" y2="66" />
        <circle cx="355" cy="64" r="5.5" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />

        {/* Strand 2 */}
        <line x1="340" y1="112" x2="372" y2="92" />
        <circle cx="374" cy="90" r="6" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />

        {/* Strand 3 */}
        <line x1="345" y1="126" x2="386" y2="124" />
        <circle cx="388" cy="124" r="5.5" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />

        {/* Strand 4 (Bottom-most right) */}
        <line x1="335" y1="140" x2="378" y2="158" />
        <circle cx="380" cy="159" r="5" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />
      </g>

      {/* --- 2. Central Blue Network Globe (Large & Heroic) --- */}
      <g>
        {/* Globe Base Sphere */}
        <circle cx="200" cy="195" r="95" fill="url(#jcnGlobeGrad)" />

        {/* Latitude Arcs (Horizontal curved network lines) */}
        <path
          d="M 110 170 Q 200 205 290 170"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M 122 225 Q 200 258 278 225"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* Longitude Arcs (Vertical curved meridian lines) */}
        <path
          d="M 174 103 Q 146 195 174 287"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M 216 101 Q 250 195 221 289"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.95"
        />
        <path
          d="M 257 113 Q 288 195 250 277"
          stroke="#FFFFFF"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Network Connection Nodes (White Dots on Grid) */}
        <circle cx="163" cy="148" r="5.2" fill="#FFFFFF" />
        <circle cx="218" cy="120" r="5.2" fill="#FFFFFF" />
        <circle cx="152" cy="195" r="5.8" fill="#FFFFFF" />
        <circle cx="196" cy="195" r="5.8" fill="#FFFFFF" />
        <circle cx="236" cy="176" r="5.2" fill="#FFFFFF" />
        <circle cx="178" cy="245" r="5.2" fill="#FFFFFF" />
        <circle cx="248" cy="240" r="5.8" fill="#FFFFFF" />
      </g>

      {/* --- 3. Curved Fiber Optic Cable Wrapping Around the Globe --- */}
      <path
        d="M 108 215 C 80 290 120 345 190 345 C 265 345 345 280 345 130 C 345 115 340 102 330 96 C 310 85 295 105 295 125 C 295 240 235 305 175 305 C 130 305 108 268 126 215 Z"
        fill="url(#jcnCableGrad)"
        stroke="#0A1124"
        strokeWidth="2.2"
      />

      {/* Lower Cable Cut Collar & Face (Bottom Left) */}
      <g transform="translate(108, 222) rotate(-35)">
        <ellipse cx="0" cy="0" rx="28" ry="16" fill="url(#jcnCollarGrad)" stroke="#0F172A" strokeWidth="2.5" />
        <ellipse cx="0" cy="0" rx="22" ry="12" fill="url(#jcnCoreFace)" />
        <circle cx="-9" cy="-1" r="3" fill="#1D68FE" />
        <circle cx="0" cy="-2" r="3.5" fill="#38BDF8" />
        <circle cx="8" cy="-1" r="3" fill="#1D68FE" />
      </g>

      {/* Upper Cable Cut Collar & Face (Top Right) */}
      <g transform="translate(326, 114) rotate(42)">
        <ellipse cx="0" cy="0" rx="26" ry="15" fill="url(#jcnCollarGrad)" stroke="#0F172A" strokeWidth="2.5" />
        <ellipse cx="0" cy="0" rx="20" ry="11" fill="url(#jcnCoreFace)" />
        <circle cx="-8" cy="0" r="3" fill="#1D68FE" />
        <circle cx="0" cy="-1" r="3.5" fill="#38BDF8" />
        <circle cx="8" cy="0" r="3" fill="#1D68FE" />
      </g>

      {/* --- 4. Bottom-Left Fiber Optic Strands (from Lower Cable Cut) --- */}
      <g stroke={strandStroke} strokeWidth="3.4" strokeLinecap="round">
        {/* Strand 1 (Top left) */}
        <line x1="90" y1="205" x2="66" y2="173" />
        <circle cx="65" cy="171" r="5.5" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />

        {/* Strand 2 (Middle upper) */}
        <line x1="82" y1="220" x2="50" y2="198" />
        <circle cx="48" cy="196" r="6" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />

        {/* Strand 3 (Middle lower) */}
        <line x1="84" y1="235" x2="54" y2="235" />
        <circle cx="52" cy="235" r="5.5" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />

        {/* Strand 4 (Bottom-most left) */}
        <line x1="94" y1="248" x2="70" y2="267" />
        <circle cx="68" cy="269" r="5" fill="#FFFFFF" stroke={strandNodeBorder} strokeWidth="2.5" />
      </g>
    </svg>
  );

  // Return based on requested variant
  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${className}`}>
        {renderIcon(size || 60)}
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        {/* Large prominent emblem */}
        {renderIcon(size || 140)}
        <div className="mt-2.5">
          {/* Sleek, proportionate typography */}
          <h1
            className="font-bold tracking-wide text-sm sm:text-base leading-tight uppercase text-slate-800"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            JET CYBER NETWORK
          </h1>
          <p
            className="text-[8px] sm:text-[9px] font-semibold tracking-[0.24em] uppercase mt-0.5 text-slate-500"
          >
            REACH WITHOUT LIMITS
          </p>
        </div>
      </div>
    );
  }

  // Default: Horizontal brand (Large hero emblem + refined, compact typography)
  return (
    <div className={`flex items-center space-x-2.5 sm:space-x-3 ${className}`}>
      {/* Enlarged, hero logo mark */}
      {renderIcon(size || 62)}
      <div className="flex flex-col justify-center select-none">
        <div className="flex items-center">
          <span
            className="font-bold text-[11px] sm:text-xs tracking-wider leading-tight uppercase text-slate-800"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            JET CYBER NETWORK
          </span>
        </div>
        <span
          className="text-[7.5px] sm:text-[8px] font-semibold tracking-[0.24em] uppercase text-slate-500 mt-0.5 leading-none"
        >
          REACH WITHOUT LIMITS
        </span>
      </div>
    </div>
  );
};
