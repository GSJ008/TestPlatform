import { memo } from "react";
import { theme } from "./theme";

// A calibration-dial timer: the exam clock rendered as an instrument gauge
// rather than plain digits. Echoes the ring/tick motif of the brand mark so
// the "precision instrument" idea shows up more than once, not just on the
// login screen. `fraction` is time remaining / total duration, 0-1.
const CircularTimer = memo(function CircularTimer({ seconds, fraction, size = 64 }) {
  const isLow = seconds <= 300; // last 5 minutes
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  const dash = c * clamped;
  const ringColor = isLow ? theme.danger : theme.accent;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={ringColor} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 1s linear, stroke 0.3s ease", filter: `drop-shadow(0 0 4px ${ringColor}66)` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
      }}>
        <span style={{
          fontFamily: theme.fontMono, fontSize: size >= 60 ? 12.5 : 11, fontWeight: 600,
          color: isLow ? theme.danger : theme.text, letterSpacing: "0.01em", lineHeight: 1
        }}>
          {h !== "00" ? `${h}:${m}` : `${m}:${s}`}
        </span>
        {size >= 60 && (
          <span style={{ fontSize: 8, color: theme.textFaint, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>
            {h !== "00" ? "left" : "remaining"}
          </span>
        )}
      </div>
    </div>
  );
});

export default CircularTimer;