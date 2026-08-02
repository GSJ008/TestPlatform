// Minimal, consistent line-icon set. Replaces every emoji in the app -
// emoji render inconsistently across OSes and read as informal for a
// professional assessment tool. All icons share the same stroke weight
// and viewBox conventions so they sit together cleanly at any size.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

export function IconClock({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconLock({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function IconShield({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    </svg>
  );
}

export function IconWarning({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M12 4l9 16H3L12 4z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17.2" r="0.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCheck({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

export function IconCheckPlain({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function IconEye({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function IconEyeOff({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.7C11 5.6 11.5 5.5 12 5.5c6.4 0 10 6.5 10 6.5a15.6 15.6 0 0 1-3.4 4.2M6.7 6.7A15.9 15.9 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.7-.3 3.8-.8" />
      <path d="M9.9 10a2.6 2.6 0 0 0 3.7 3.7" />
    </svg>
  );
}

export function IconUser({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20c1-4 4-6 7-6s6 2 7 6" />
    </svg>
  );
}

export function IconClipboard({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  );
}

export function IconExpand({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
    </svg>
  );
}

export function IconChevronDown({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconArrowRight({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconPlay({ size = 14, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ ...style }} fill="currentColor" stroke="none">
      <path d="M6 4.5v15l13-7.5-13-7.5z" />
    </svg>
  );
}

export function IconDot({ size = 8, color = "currentColor", style }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%",
        background: color, display: "inline-block", flexShrink: 0,
        ...style
      }}
    />
  );
}

export function IconCamera({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <rect x="3" y="7" width="14" height="11" rx="2" />
      <path d="M17 10l4-2.5v9L17 14" />
      <circle cx="10" cy="12.5" r="2.6" />
    </svg>
  );
}

export function IconMic({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

export function IconCode({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M9 6L3 12l6 6M15 6l6 6-6 6" />
    </svg>
  );
}

export function IconBriefcase({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </svg>
  );
}

export function IconLayers({ size = 16, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} {...base}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}
// into a shield), used as the wordmark glyph and reused as the motif behind
// the exam timer. Rendered with a gradient + soft drop shadow so it reads
// as a physical badge rather than a flat icon.
export function BrandMark({ size = 40 }) {
  const gradId = "brandMarkGrad";
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ filter: "drop-shadow(0 6px 14px rgba(74,99,224,0.45))" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6d84f0" />
          <stop offset="100%" stopColor="#3a4fc0" />
        </linearGradient>
      </defs>
      <path d="M24 3 L43 11 V25 C43 36 35 43 24 46 C13 43 5 36 5 25 V11 Z" fill={`url(#${gradId})`} />
      <path d="M24 3 L43 11 V25 C43 36 35 43 24 46 Z" fill="rgba(255,255,255,0.08)" />
      <circle cx="24" cy="23" r="10" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
      <path d="M24 15v3M24 28v3M16 23h3M29 23h3" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M24 23l4.5-4.5" stroke="#e8eaed" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="23" r="1.6" fill="#e8eaed" />
    </svg>
  );
}