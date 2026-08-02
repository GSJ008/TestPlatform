import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { theme } from "./theme";
import { IconCheck, IconWarning, IconClock } from "./icons";

export default function VerifyEmail() {
  const [status, setStatus] = useState("checking"); // "checking" | "success" | "error"
  const [message, setMessage] = useState("Verifying your email...");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    axios
      .get(`${process.env.REACT_APP_API_URL}/verify-email`, { params: { token } })
      .then((res) => {
        setStatus("success");
        setMessage(res.data.message || "Email verified. You can now log in.");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.response?.data?.message || "This verification link is invalid or has expired.");
      });
  }, [searchParams]);

  const iconColor = status === "success" ? theme.success : status === "error" ? theme.danger : theme.accent;
  const Icon = status === "success" ? IconCheck : status === "error" ? IconWarning : IconClock;

  return (
    <div style={{
      minHeight: "100vh",
      background: theme.bgGradient,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: theme.fontSans,
      padding: 20
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: theme.panel,
        borderRadius: theme.radiusLg,
        padding: "40px 32px",
        textAlign: "center",
        boxShadow: theme.shadowCard
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: "50%", margin: "0 auto 20px",
          background: theme.panelRaised, boxShadow: theme.shadowRaised,
          display: "flex", alignItems: "center", justifyContent: "center", color: iconColor
        }}>
          <Icon size={26} />
        </div>
        <h2 style={{ color: theme.text, marginBottom: 10, fontSize: 19, fontWeight: 700 }}>
          {status === "checking" && "Verifying email"}
          {status === "success" && "Email verified"}
          {status === "error" && "Verification failed"}
        </h2>
        <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: 26 }}>
          {message}
        </p>
        {status !== "checking" && (
          <button
            className="elev-btn"
            onClick={() => navigate("/")}
            style={{
              padding: "12px 30px",
              background: theme.accentGradient,
              color: "white",
              border: "none",
              borderRadius: theme.radiusSm,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: theme.fontSans,
              boxShadow: `${theme.shadowButton}, ${theme.shadowGlow}`
            }}
          >
            Go to sign in
          </button>
        )}
      </div>
    </div>
  );
}