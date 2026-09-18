import { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  LogIn,
  Check,
} from "lucide-react";
import { auth } from "./firebase";

const SAVED_EMAIL_KEY = "rana_admin_email";
const SAVE_LOGIN_KEY = "rana_admin_save_login";

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saveLogin, setSaveLogin] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const savedPreference =
      localStorage.getItem(SAVE_LOGIN_KEY) === "true";

    if (savedEmail) {
      setEmail(savedEmail);
    }

    setSaveLogin(savedPreference);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSavedMessage(false);
    setLoading(true);

    try {
      if (saveLogin) {
        localStorage.setItem(SAVED_EMAIL_KEY, email.trim());
        localStorage.setItem(SAVE_LOGIN_KEY, "true");
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
        localStorage.removeItem(SAVE_LOGIN_KEY);
      }

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      onLogin();
    } catch (err) {
      console.error(err);
      setError("Gmail অথবা Password ভুল।");
    } finally {
      setLoading(false);
    }
  };

  const toggleSave = () => {
    const next = !saveLogin;
    setSaveLogin(next);

    if (next) {
      localStorage.setItem(
        SAVED_EMAIL_KEY,
        email.trim()
      );
      localStorage.setItem(SAVE_LOGIN_KEY, "true");
      setSavedMessage(true);

      setTimeout(() => {
        setSavedMessage(false);
      }, 1800);
    } else {
      localStorage.removeItem(SAVED_EMAIL_KEY);
      localStorage.removeItem(SAVE_LOGIN_KEY);
      setSavedMessage(false);
    }
  };

  return (
    <main
      className="payment-page"
      style={{
        minHeight: "100dvh",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <section
        className="payment-card"
        style={{
          width: "min(100%, 430px)",
          maxWidth: "430px",
          padding: "28px 22px",
          boxSizing: "border-box",
        }}
      >
        {/* Brand */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "26px",
          }}
        >
          <div
            className="brand-mark"
            style={{
              margin: "0 auto 14px",
              width: "58px",
              height: "58px",
              fontSize: "24px",
            }}
          >
            R
          </div>

          <h1
            style={{
              color: "#ffffff",
              margin: 0,
              fontSize: "22px",
              letterSpacing: "0.04em",
            }}
          >
            RANA PAYMENT
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              opacity: 0.55,
              fontSize: "13px",
            }}
          >
            Secure Admin Access
          </p>
        </div>

        {/* Security badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "7px",
            marginBottom: "20px",
            fontSize: "11px",
            opacity: 0.65,
          }}
        >
          <ShieldCheck size={15} />
          Protected by Firebase Authentication
        </div>

        <form
          onSubmit={handleLogin}
          style={{
            display: "grid",
            gap: "15px",
          }}
        >
          {/* Gmail */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                opacity: 0.62,
                textTransform: "uppercase",
              }}
            >
              Gmail / Email
            </label>

            <div
              style={{
                position: "relative",
              }}
            >
              <Mail
                size={18}
                style={{
                  position: "absolute",
                  left: "15px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: 0.5,
                }}
              />

              <input
                type="email"
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                autoComplete="email"
                required
                style={{
                  width: "100%",
                  minHeight: "52px",
                  boxSizing: "border-box",
                  padding:
                    "0 15px 0 45px",
                  borderRadius: "15px",
                  border:
                    "1px solid rgba(255,255,255,0.11)",
                  background:
                    "rgba(255,255,255,0.055)",
                  color: "#ffffff",
                  outline: "none",
                  fontSize: "14px",
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                opacity: 0.62,
                textTransform: "uppercase",
              }}
            >
              Password
            </label>

            <div
              style={{
                position: "relative",
              }}
            >
              <LockKeyhole
                size={18}
                style={{
                  position: "absolute",
                  left: "15px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  opacity: 0.5,
                }}
              />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter your password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                autoComplete="current-password"
                required
                style={{
                  width: "100%",
                  minHeight: "52px",
                  boxSizing: "border-box",
                  padding:
                    "0 48px 0 45px",
                  borderRadius: "15px",
                  border:
                    "1px solid rgba(255,255,255,0.11)",
                  background:
                    "rgba(255,255,255,0.055)",
                  color: "#ffffff",
                  outline: "none",
                  fontSize: "14px",
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform:
                    "translateY(-50%)",
                  width: "38px",
                  height: "38px",
                  borderRadius: "11px",
                  border: "none",
                  background:
                    "rgba(255,255,255,0.05)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {showPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </div>
          </div>

          {/* Save checkbox */}
          <button
            type="button"
            onClick={toggleSave}
            style={{
              width: "100%",
              minHeight: "50px",
              padding: "0 14px",
              borderRadius: "15px",
              border:
                saveLogin
                  ? "1px solid rgba(255,255,255,0.16)"
                  : "1px solid rgba(255,255,255,0.08)",
              background:
                saveLogin
                  ? "rgba(255,255,255,0.075)"
                  : "rgba(255,255,255,0.035)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: "11px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: "22px",
                height: "22px",
                borderRadius: "7px",
                border:
                  "1px solid rgba(255,255,255,0.18)",
                background:
                  saveLogin
                    ? "#ffffff"
                    : "rgba(255,255,255,0.03)",
                color: "#111111",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {saveLogin && (
                <Check size={15} />
              )}
            </span>

            <span
              style={{
                flex: 1,
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Save Gmail
              <small
                style={{
                  display: "block",
                  opacity: 0.45,
                  fontWeight: 500,
                  marginTop: "2px",
                }}
              >
                Next time Gmail will be filled automatically
              </small>
            </span>

            {savedMessage && (
              <span
                style={{
                  fontSize: "11px",
                  opacity: 0.7,
                }}
              >
                Saved
              </span>
            )}
          </button>

          {error && (
            <div
              style={{
                padding: "11px 13px",
                borderRadius: "12px",
                background:
                  "rgba(255,80,80,0.08)",
                border:
                  "1px solid rgba(255,80,80,0.18)",
                color: "#ffb0b0",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="paid-button"
            disabled={loading}
            style={{
              width: "100%",
              minHeight: "54px",
              marginTop: "2px",
              justifyContent: "center",
            }}
          >
            <LogIn size={19} />
            {loading
              ? "Signing in..."
              : "Admin Login"}
          </button>
        </form>

        <div
          className="secure-note"
          style={{
            justifyContent: "center",
            marginTop: "18px",
            fontSize: "11px",
          }}
        >
          <ShieldCheck size={15} />
          <span>Secure administrator access</span>
        </div>
      </section>
    </main>
  );
}
