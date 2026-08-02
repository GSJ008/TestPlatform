import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "./theme";
import { BrandMark, IconEye, IconEyeOff, IconWarning, IconCheckPlain } from "./icons";

const S = {
  page: {
    minHeight: "100vh",
    background: theme.bgGradient,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: theme.fontSans,
    padding: 20
  },
  container: {
    width: "100%",
    maxWidth: 420
  },
  logo: {
    textAlign: "center",
    marginBottom: 32,
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  },
  logoText: {
    fontSize: 24,
    fontWeight: 800,
    color: theme.text,
    letterSpacing: "-0.4px",
    marginTop: 16
  },
  logoSub: {
    fontSize: 12.5,
    color: theme.textFaint,
    marginTop: 5,
    letterSpacing: "0.08em",
    textTransform: "uppercase"
  },
  card: {
    background: theme.panel,
    borderRadius: theme.radiusLg,
    padding: "34px",
    boxShadow: theme.shadowCard
  },
  tabs: {
    display: "flex",
    marginBottom: 26,
    borderRadius: theme.radiusSm,
    background: theme.wellBg,
    boxShadow: theme.wellShadow,
    padding: 4,
    gap: 4
  },
  tab: (active) => ({
    flex: 1,
    padding: "9px",
    background: active ? theme.accentGradient : "transparent",
    boxShadow: active ? theme.shadowButton : "none",
    border: "none",
    borderRadius: 6,
    color: active ? "white" : theme.textFaint,
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: theme.fontSans,
    cursor: "pointer",
    transition: "all 0.2s"
  }),
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    margin: "22px 0",
    color: theme.textFaint,
    fontSize: 11,
    letterSpacing: "0.06em",
    textTransform: "uppercase"
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: theme.surfaceBorder
  },
  field: {
    marginBottom: 16
  },
  label: {
    display: "block",
    fontSize: 11.5,
    fontWeight: 600,
    color: theme.textMuted,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: 7
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    background: theme.wellBg,
    boxShadow: theme.wellShadow,
    border: "1px solid transparent",
    borderRadius: theme.radiusSm,
    color: theme.text,
    fontSize: 14,
    fontFamily: theme.fontSans,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s"
  },
  btn: {
    width: "100%",
    padding: "13px",
    background: theme.accentGradient,
    color: "white",
    border: "none",
    borderRadius: theme.radiusSm,
    fontSize: 14.5,
    fontWeight: 600,
    fontFamily: theme.fontSans,
    cursor: "pointer",
    marginTop: 8,
    boxShadow: `${theme.shadowButton}, ${theme.shadowGlow}`,
    transition: "transform 0.1s ease"
  },
  linkBtn: {
    background: "none",
    border: "none",
    color: theme.accentBright,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    fontFamily: theme.fontSans,
    textDecoration: "underline"
  },
  message: (type) => ({
    background: type === "error" ? theme.dangerSoft : theme.successSoft,
    border: `1px solid ${type === "error" ? "rgba(229,85,95,0.35)" : "rgba(52,199,147,0.35)"}`,
    borderRadius: theme.radiusSm,
    padding: "11px 14px",
    color: type === "error" ? theme.danger : theme.success,
    fontSize: 13,
    marginBottom: 18,
    lineHeight: 1.5,
    display: "flex",
    gap: 9,
    alignItems: "flex-start"
  })
};

export default function Login() {
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: "error"|"success", text, showResend? }
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const googleBtnRef = useRef(null);

  const getErrorMessage = (err) => {
    if (err.response?.data?.message) return err.response.data.message;
    if (err.request) return "Could not reach the server. Is it running?";
    return "Something went wrong. Please try again.";
  };

  const handleGoogleCredential = async (response) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/auth/google`, {
        credential: response.credential
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  // Render Google's own "Sign in with Google" button once the GIS script
  // (loaded async in public/index.html) is available and we have a client
  // ID. The script loads asynchronously, so it may not exist yet the
  // instant this component mounts - checking only once (as this used to)
  // meant that on a slow network the check would run too early, silently
  // find nothing, and never try again, leaving no button and no error.
  // Polling briefly until it appears fixes that without needing to touch
  // index.html.
  useEffect(() => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    let cancelled = false;
    let attempts = 0;

    const tryRender = () => {
      if (cancelled) return;
      attempts += 1;

      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "filled_black",
          size: "large",
          width: 356,
          shape: "pill",
          text: "continue_with"
        });
        return;
      }

      if (attempts < 50) {
        // Keep checking every 100ms for up to 5s - covers slow connections
        // without polling forever if the script genuinely fails to load.
        setTimeout(tryRender, 100);
      } else {
        console.warn("Google Identity Services script never became available - check that the <script> tag in public/index.html loaded (network tab / ad blockers can block accounts.google.com).");
      }
    };

    tryRender();
    return () => { cancelled = true; };
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setMessage({ type: "error", text: "Name, email and password are all required." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/register`, { name, email, password });
      setMessage({ type: "success", text: res.data.message || "Account created. Check your email to verify it." });
      setTab("login");
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage({ type: "error", text: "Email and password are required." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/login`, { email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      const code = err.response?.data?.code;
      setMessage({
        type: "error",
        text: getErrorMessage(err),
        showResend: code === "EMAIL_NOT_VERIFIED"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await axios.post(`${process.env.REACT_APP_API_URL}/resend-verification`, { email });
      setMessage({ type: "success", text: res.data.message || "Verification email sent." });
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setResending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") tab === "login" ? handleLogin() : handleRegister();
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.logo}>
          <BrandMark size={44} />
          <div style={S.logoText}>AI Test Platform</div>
          <div style={S.logoSub}>Secure &middot; Proctored &middot; AI-Powered</div>
        </div>

        <div style={S.card}>
          <div style={S.tabs}>
            <button className="elev-btn" style={S.tab(tab === "login")} onClick={() => { setTab("login"); setMessage(null); }}>
              Sign In
            </button>
            <button className="elev-btn" style={S.tab(tab === "register")} onClick={() => { setTab("register"); setMessage(null); }}>
              Create Account
            </button>
          </div>

          {message && (
            <div style={S.message(message.type)}>
              {message.type === "error" ? <IconWarning size={15} style={{ marginTop: 1, flexShrink: 0 }} /> : <IconCheckPlain size={15} style={{ marginTop: 1, flexShrink: 0 }} />}
              <div>
                <div>{message.text}</div>
                {message.showResend && (
                  <div style={{ marginTop: 8 }}>
                    <button style={S.linkBtn} onClick={handleResend} disabled={resending}>
                      {resending ? "Sending..." : "Resend verification email"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Google Sign-In button - rendered by Google's own script */}
          <div ref={googleBtnRef} style={{ display: "flex", justifyContent: "center", marginBottom: 6 }} />
          {!process.env.REACT_APP_GOOGLE_CLIENT_ID && (
            <div style={{ fontSize: 11, color: theme.textFaint, textAlign: "center", marginBottom: 10 }}>
              Google Sign-In is not configured (missing REACT_APP_GOOGLE_CLIENT_ID)
            </div>
          )}

          <div style={S.divider}>
            <span style={S.dividerLine} />
            <span>or continue with email</span>
            <span style={S.dividerLine} />
          </div>

          {tab === "register" && (
            <div style={S.field}>
              <label style={S.label}>Full Name</label>
              <input
                style={S.input}
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKey}
                autoComplete="name"
              />
            </div>
          )}

          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input
              style={S.input}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="email"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...S.input, paddingRight: 44 }}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKey}
                autoComplete={tab === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: theme.textFaint,
                  padding: 0,
                  lineHeight: 1,
                  display: "flex"
                }}
              >
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
          </div>

          <button
            className="elev-btn"
            style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}
            onClick={tab === "login" ? handleLogin : handleRegister}
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : tab === "login" ? "Sign In" : "Create Account"
            }
          </button>

          {tab === "register" && (
            <p style={{ fontSize: 12, color: theme.textFaint, textAlign: "center", marginTop: 14, lineHeight: 1.5 }}>
              We'll email you a verification link before you can sign in.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}