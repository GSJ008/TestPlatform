import { useEffect, useRef, useState } from "react";
import { theme } from "./theme";
import { IconChevronDown, IconCheckPlain } from "./icons";

// Native <select> dropdown lists are rendered by the OS/browser, not by our
// CSS - that's why the language picker looked broken once opened (it was
// silently falling back to default browser chrome, ignoring our dark
// theme). This is a full replacement: the trigger button and the option
// list are both plain themed divs we control completely, so it always
// matches the rest of the app.
export default function Dropdown({ value, onChange, options, triggerStyle, small }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const normalized = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = normalized.find((o) => o.value === value);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        className="elev-btn"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: small ? theme.wellBg : theme.panelFlat,
          boxShadow: small ? theme.wellShadow : theme.shadowSm,
          border: small ? "none" : `1px solid ${theme.surfaceBorder}`,
          borderRadius: theme.radiusSm,
          color: theme.text,
          padding: small ? "7px 12px" : "11px 14px",
          fontSize: small ? 13 : 14,
          fontFamily: theme.fontSans,
          fontWeight: small ? 500 : 400,
          cursor: "pointer",
          ...triggerStyle
        }}
      >
        <span>{selected ? selected.label : "Select..."}</span>
        <IconChevronDown
          size={13}
          style={{ color: theme.textFaint, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          background: theme.panelRaised,
          border: `1px solid ${theme.surfaceBorderStrong}`,
          borderRadius: theme.radiusSm,
          boxShadow: theme.shadowFloating,
          zIndex: 80,
          maxHeight: 260,
          overflowY: "auto",
          padding: 4
        }}>
          {normalized.map((o) => {
            const isSelected = o.value === value;
            return (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  padding: "9px 12px",
                  fontSize: 13.5,
                  borderRadius: 6,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: isSelected ? theme.accentBright : theme.text,
                  background: isSelected ? theme.accentSoft : "transparent",
                  fontWeight: isSelected ? 600 : 400
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = theme.surfaceHover; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                {o.label}
                {isSelected && <IconCheckPlain size={13} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}