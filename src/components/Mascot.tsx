/**
 * An original mascot: a fisheye-lens selfie of nobody in particular, drawn
 * from scratch in SVG as a nod to the "goofy ahh pictures" format (distorted,
 * fisheye, bizarre-perspective photos). No meme image is copied or bundled;
 * see the README's "Visual identity" section.
 */
export default function Mascot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 240" className={className} role="img" aria-label="A goofy fisheye-distorted cartoon face">
      <defs>
        <radialGradient id="skin" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#ffe08a" />
          <stop offset="70%" stopColor="#f5b942" />
          <stop offset="100%" stopColor="#c9791b" />
        </radialGradient>
        <radialGradient id="nose" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffb4a2" />
          <stop offset="100%" stopColor="#e0584a" />
        </radialGradient>
        <radialGradient id="lens" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <filter id="wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="7">
            <animate attributeName="seed" values="7;9;11;7" dur="2.4s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
        <clipPath id="circle">
          <circle cx="120" cy="120" r="116" />
        </clipPath>
      </defs>
      <g clipPath="url(#circle)">
        <rect width="240" height="240" fill="#7c3aed" />
        <path d="M0 170 Q120 120 240 170 V240 H0Z" fill="#4c1d95" />
        <g filter="url(#wobble)">
          {/* forehead way too big, chin way too small: the fisheye look */}
          <path d="M28 110 C22 30 218 30 212 110 C206 170 170 222 120 224 C70 222 34 170 28 110Z" fill="url(#skin)" />
          {/* tiny eyes, far apart */}
          <ellipse cx="72" cy="104" rx="11" ry="13" fill="#fff" />
          <ellipse cx="170" cy="100" rx="9" ry="12" fill="#fff" />
          <circle cx="75" cy="108" r="5" fill="#111" />
          <circle cx="166" cy="104" r="4" fill="#111" />
          <path d="M56 84 q16 -12 32 -2" stroke="#6b3a10" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M156 80 q14 -8 28 4" stroke="#6b3a10" strokeWidth="5" fill="none" strokeLinecap="round" />
          {/* enormous nose, closest thing to the lens */}
          <ellipse cx="120" cy="138" rx="42" ry="36" fill="url(#nose)" />
          <ellipse cx="106" cy="150" rx="7" ry="5" fill="#8a2a22" />
          <ellipse cx="134" cy="150" rx="7" ry="5" fill="#8a2a22" />
          <ellipse cx="108" cy="124" rx="12" ry="7" fill="#fff" opacity="0.5" />
          {/* grin */}
          <path d="M84 184 Q120 212 158 182 Q120 196 84 184Z" fill="#3b0d0d" />
          <rect x="112" y="186" width="9" height="9" rx="1.5" fill="#fff" />
          <rect x="123" y="185" width="9" height="10" rx="1.5" fill="#fff" />
        </g>
        <circle cx="120" cy="120" r="116" fill="url(#lens)" />
      </g>
      <circle cx="120" cy="120" r="116" fill="none" stroke="#fde047" strokeWidth="6" />
    </svg>
  );
}
