// Shared design tokens for the whole app.
//
// Direction: "precision instrument panel" rather than generic dark-mode SaaS.
// Cobalt is the primary signal color; muted brass is a secondary
// "instrumentation" accent used sparingly (dial ticks, verified marks).
//
// 3D approach: every raised surface uses a subtle top-to-bottom GRADIENT
// (not a flat fill) plus a bright hairline top highlight and a dark
// contact shadow directly beneath it - the combination is what actually
// reads as "catching light from above" rather than just a border. Recessed
// surfaces (inputs, code, output) invert this: dark gradient + inset
// shadow, so they look pressed into the page. Interactive elements lift
// further on hover and compress on press - depth responds to touch, not
// just to being drawn once.

export const theme = {
  // ---- base ----
  bg: "#0a0b0d",
  bgGradient: "linear-gradient(165deg, #0a0b0d 0%, #0d0f12 50%, #090a0c 100%)",

  // ---- raised surfaces (cards, panels, buttons) - gradients, not flat fills ----
  panel: "linear-gradient(180deg, #191d24 0%, #12151a 100%)",
  panelRaised: "linear-gradient(180deg, #1e222b 0%, #151920 100%)",
  panelFlat: "#14171c", // for places a gradient can't be used (e.g. <select> background)
  surface: "rgba(255,255,255,0.035)",
  surfaceHover: "rgba(255,255,255,0.06)",
  surfaceBorder: "rgba(255,255,255,0.08)",
  surfaceBorderStrong: "rgba(255,255,255,0.16)",

  // ---- recessed surfaces (inputs, code, output) ----
  wellBg: "linear-gradient(180deg, #060708 0%, #0a0c0f 100%)",
  wellShadow: "inset 0 2px 6px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(0,0,0,0.5)",

  // ---- accent: cobalt (primary signal) ----
  accent: "#4a63e0",
  accentDim: "#3a4fc0",
  accentBright: "#7b90f3",
  accentSoft: "rgba(74,99,224,0.14)",
  accentBorder: "rgba(74,99,224,0.4)",
  accentGradient: "linear-gradient(160deg, #647bec 0%, #3a4fc0 100%)",

  // ---- accent: brass (secondary, instrumentation only) ----
  brass: "#c9a24b",
  brassSoft: "rgba(201,162,75,0.16)",

  // ---- text ----
  text: "#eef0f3",
  textMuted: "#8a93a3",
  textFaint: "#565d6b",

  // ---- status ----
  success: "#34c793",
  warning: "#e3a83b",
  danger: "#e5555f",
  successSoft: "rgba(52,199,147,0.12)",
  warningSoft: "rgba(227,168,59,0.12)",
  dangerSoft: "rgba(229,85,95,0.12)",

  // ---- type ----
  fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",

  // ---- shape ----
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 18,

  // ---- elevation: top highlight (bright) + contact shadow (dark) + ambient (soft, wide) ----
  shadowSm: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 3px rgba(0,0,0,0.55)",
  shadowCard: "inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -1px 0 rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.5), 0 24px 48px -14px rgba(0,0,0,0.75)",
  shadowRaised: "inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.5), 0 12px 24px -8px rgba(0,0,0,0.65)",
  shadowRaisedHover: "inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.35), 0 3px 6px rgba(0,0,0,0.5), 0 18px 32px -8px rgba(0,0,0,0.7)",
  shadowButton: "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.3), 0 2px 3px rgba(0,0,0,0.5), 0 8px 18px -4px rgba(0,0,0,0.6)",
  shadowButtonPressed: "inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)",
  shadowGlow: "0 8px 24px -6px rgba(74,99,224,0.5)",
  shadowFloating: "0 30px 70px -18px rgba(0,0,0,0.8)",
};