import AdminLogin from "./AdminLogin";
import Admin from "./Admin";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { signInAnonymously } from "firebase/auth";
import { QRCodeSVG } from "qrcode.react";
import {
  Smartphone,
  ShieldCheck,
  Copy,
  Check,
  Clock3,
  ArrowLeft,
  X,
  Download,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./App.css";

const DEFAULT_PAYMENT = {
  amount: 100,
  upiId: "alwaysadmin-1@okhdfcbank",
  merchantName: "RANA PAYMENT",
  productName: "Premium File",
  description:
    "Complete your payment to unlock the premium download.",
  expiryMinutes: 5,
  downloadUrl: "",
};

const REQUEST_LIFETIME = 5 * 60 * 1000;

export default function App() {
  const [product, setProduct] = useState(null);
  const [productLoading, setProductLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("payment");
  const [showFullQr, setShowFullQr] = useState(false);
  const [approvedDownloadUrl, setApprovedDownloadUrl] = useState("");
  const [showDownloadPage, setShowDownloadPage] = useState(true);

  const [paymentId, setPaymentId] = useState(
    sessionStorage.getItem("paymentId")
  );

  const [adminLoggedIn, setAdminLoggedIn] = useState(false);

  const creatingRequest = useRef(false);

  const isAdmin = window.location.hash === "#admin";

  const productId = new URLSearchParams(
    window.location.search
  ).get("product");

  useEffect(() => {
    if (isAdmin) return;

    const loadProduct = async () => {
      setProductLoading(true);

      try {
        // Authenticate the customer BEFORE reading the product.
        // Firestore rules currently require request.auth for products.
        await signInAnonymously(auth);

        if (!productId) {
          setProduct(DEFAULT_PAYMENT);
          return;
        }

        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          setProduct(null);
          return;
        }

        const data = productSnap.data();

        if (data.active === false) {
          setProduct(null);
          return;
        }

        setProduct({
          id: productSnap.id,
          ...data,
        });
      } catch (error) {
        console.error("Product load error:", error);
        setProduct(null);
      } finally {
        setProductLoading(false);
      }
    };

    loadProduct();
  }, [productId, isAdmin]);

  useEffect(() => {
    if (isAdmin || !product || !productId) return;

    const createOrRestoreRequest = async () => {
      if (creatingRequest.current) return;

      creatingRequest.current = true;

      try {
        await signInAnonymously(auth);

        const savedPaymentId =
          sessionStorage.getItem("paymentId");

        const savedProductId =
          sessionStorage.getItem("paymentProductId");

        if (
          savedPaymentId &&
          savedProductId === product.id
        ) {
          const paymentRef = doc(
            db,
            "payments",
            savedPaymentId
          );

          const paymentSnap = await getDoc(paymentRef);

          if (paymentSnap.exists()) {
            const data = paymentSnap.data();

            const createdTime =
              data.createdAt?.toMillis?.() || 0;

            const requestAge =
              createdTime > 0
                ? Date.now() - createdTime
                : REQUEST_LIFETIME + 1;

            if (
              createdTime > 0 &&
              requestAge < REQUEST_LIFETIME
            ) {
              setPaymentId(savedPaymentId);

              if (data.status === "approved") {
                const downloadUrl = data.downloadUrl || product.downloadUrl || "";
                setApprovedDownloadUrl(downloadUrl);
                setStatus("verified");
                setShowDownloadPage(false);
                window.setTimeout(() => setShowDownloadPage(true), 1800);
              } else if (data.status === "rejected") {
                setStatus("rejected");
              } else if (
                sessionStorage.getItem(
                  "paymentStarted"
                ) === "true"
              ) {
                setStatus("pending");
              } else {
                setStatus("payment");
              }

              creatingRequest.current = false;
              return;
            }
          }
        }

        sessionStorage.removeItem("paymentId");
        sessionStorage.removeItem("paymentProductId");
        sessionStorage.removeItem("paymentStarted");

        const docRef = await addDoc(
          collection(db, "payments"),
          {
            productId: product.id,
            status: "pending",
            amount: Number(product.amount),
            upiId: product.upiId,
            merchantName:
              product.merchantName || "RANA PAYMENT",
            productName: product.name,
            description: product.description || "",
            downloadUrl: product.downloadUrl || "",
            expiryMinutes:
              Number(product.expiryMinutes) || 5,
            createdAt: serverTimestamp(),
          }
        );

        sessionStorage.setItem("paymentId", docRef.id);
        sessionStorage.setItem(
          "paymentProductId",
          product.id
        );
        sessionStorage.removeItem("paymentStarted");

        setPaymentId(docRef.id);
        setStatus("payment");
      } catch (error) {
        console.error(
          "Payment request error:",
          error
        );
        setStatus("payment");
      } finally {
        creatingRequest.current = false;
      }
    };

    createOrRestoreRequest();
  }, [product, productId, isAdmin]);

  useEffect(() => {
    if (!paymentId || isAdmin) return;

    const paymentRef = doc(db, "payments", paymentId);
    let stopped = false;

    const applyPaymentStatus = (data) => {
      if (!data) return;

      if (data.status === "approved") {
        setApprovedDownloadUrl(
          data.downloadUrl || product?.downloadUrl || ""
        );
        setStatus("verified");
        setShowDownloadPage(true);

        return;
      }

      if (data.status === "rejected") {
        setStatus("rejected");
        return;
      }

      if (data.status === "pending") {
        setStatus(
          sessionStorage.getItem("paymentStarted") === "true"
            ? "pending"
            : "payment"
        );
      }
    };

    const checkPayment = async () => {
      try {
        const snapshot = await getDoc(paymentRef);

        if (!snapshot.exists()) {
          return;
        }

        applyPaymentStatus(snapshot.data());
      } catch (error) {
        console.error("Payment polling error:", error);
      }
    };

    // Immediate check.
    checkPayment();

    // Realtime listener.
    const unsubscribe = onSnapshot(
      paymentRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        applyPaymentStatus(snapshot.data());
      },
      (error) => {
        console.error("Payment realtime error:", error);
      }
    );

    // Fallback for local/mobile browsers where realtime delivery
    // can be delayed until a refresh or visibility change.
    const poll = window.setInterval(
      checkPayment,
      1000
    );

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkPayment();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      stopped = true;

      window.clearInterval(poll);
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
      unsubscribe();
    };
  }, [paymentId, isAdmin, product]);

  useEffect(() => {
    if (isAdmin) return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const savedPaymentId =
        sessionStorage.getItem("paymentId");

      const savedProductId =
        sessionStorage.getItem("paymentProductId");

      const paymentStarted =
        sessionStorage.getItem("paymentStarted");

      if (
        savedPaymentId &&
        savedProductId === productId
      ) {
        setPaymentId(savedPaymentId);

        if (paymentStarted === "true") {
          setStatus("pending");
        } else {
          setStatus("payment");
        }
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () =>
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
  }, [isAdmin, productId]);

  const copyUpi = async () => {
    if (!product?.upiId) return;

    try {
      await navigator.clipboard.writeText(
        product.upiId
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      alert("UPI ID copy করা যায়নি");
    }
  };

  const openUpi = () => {
    if (!paymentId || !product) {
      alert(
        "Payment request তৈরি হচ্ছে। একটু পরে আবার চেষ্টা করো।"
      );
      return;
    }

    sessionStorage.setItem(
      "paymentStarted",
      "true"
    );

    setStatus("pending");

    window.location.href = upiLink;
  };

  const backToPayment = () => {
    sessionStorage.removeItem("paymentStarted");
    setStatus("payment");
  };

  if (isAdmin && !adminLoggedIn) {
    return (
      <AdminLogin
        onLogin={() => setAdminLoggedIn(true)}
      />
    );
  }

  if (isAdmin && adminLoggedIn) {
    return <Admin />;
  }

  if (productLoading) {
    return (
      <main className="payment-page">
        <section className="payment-card">
          <div className="brand">
            <div className="brand-mark">R</div>

            <div>
              <h1 style={{ color: "#ffffff" }}>
                RANA PAYMENT
              </h1>

              <p>Loading Payment Link...</p>
            </div>
          </div>

          <div className="qr-section">
            <div className="loader-ring">
              <div className="loader-inner">
                <RefreshCw size={30} />
              </div>
            </div>

            <h2>Loading...</h2>

            <p>
              Payment configuration loading হচ্ছে।
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="payment-page">
        <section className="payment-card">
          <div className="brand">
            <div className="brand-mark">R</div>

            <div>
              <h1 style={{ color: "#ffffff" }}>
                RANA PAYMENT
              </h1>

              <p>Payment Link</p>
            </div>
          </div>

          <div className="qr-section">
            <div className="loader-ring">
              <div className="loader-inner">
                <X size={30} />
              </div>
            </div>

            <h2>Link Unavailable</h2>

            <p>
              এই payment link আর active নেই।
            </p>
          </div>
        </section>
      </main>
    );
  }

  const upiLink =
    `upi://pay?pa=${encodeURIComponent(
      product.upiId
    )}` +
    `&pn=${encodeURIComponent(
      product.merchantName || "RANA PAYMENT"
    )}` +
    `&am=${Number(product.amount).toFixed(2)}` +
    `&cu=INR`;

  if (status === "verified" && !showDownloadPage) {
    return (
      <main className="payment-page">
        <div className="background-glow glow-one" />
        <div className="background-glow glow-two" />

        <section className="payment-card">
          <div className="brand">
            <div className="brand-mark">R</div>

            <div>
              <h1 style={{ color: "#ffffff" }}>
                RANA PAYMENT
              </h1>
              <p>Payment Successful</p>
            </div>
          </div>

          <div className="qr-section">
            <div className="loader-ring">
              <div className="loader-inner">
                <Check size={34} />
              </div>
            </div>

            <h2>Payment Successful ✓</h2>

            <p>
              Your payment has been verified successfully.
            </p>

            <div className="processing-dots">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="secure-note">
            <ShieldCheck size={17} />
            <span>Preparing your premium download...</span>
          </div>
        </section>
      </main>
    );
  }

  if (status === "verified" && showDownloadPage) {
    const finalDownloadUrl =
      approvedDownloadUrl || product.downloadUrl || "";

    return (
      <main className="payment-page">
        <div className="background-glow glow-one" />
        <div className="background-glow glow-two" />

        <section className="payment-card">
          <div className="brand">
            <div className="brand-mark">R</div>

            <div>
              <h1 style={{ color: "#ffffff" }}>
                RANA PAYMENT
              </h1>
              <p>Premium Download</p>
            </div>
          </div>

          <div className="product-box">
            <div>
              <span className="eyebrow">PAYMENT VERIFIED</span>

              <h2 style={{ color: "#ffffff" }}>
                {product.name || "Premium File"}
              </h2>

              <p>
                {product.description ||
                  "Your payment has been verified. Your premium file is ready."}
              </p>
            </div>

            <div className="amount">
              <Check size={24} />
            </div>
          </div>

          <div
            style={{
              marginTop: "22px",
              padding: "22px",
              borderRadius: "20px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "78px",
                height: "78px",
                margin: "0 auto 14px",
                borderRadius: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              <Download size={34} />
            </div>

            <h3 style={{ color: "#ffffff", margin: "0 0 8px" }}>
              Download Ready
            </h3>

            <p style={{ margin: 0 }}>
              Payment verified successfully. Tap below to
              download your premium file.
            </p>
          </div>

          {finalDownloadUrl ? (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                borderRadius: "18px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "1.5px",
                  opacity: 0.55,
                  marginBottom: "8px",
                }}
              >
                DOWNLOAD
              </div>

              <div
                style={{
                  padding: "12px 13px",
                  borderRadius: "12px",
                  background: "rgba(0,0,0,0.20)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  wordBreak: "break-all",
                  opacity: 0.75,
                }}
              >
                {finalDownloadUrl}
              </div>

              <a
                className="paid-button"
                href={finalDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  textDecoration: "none",
                  justifyContent: "center",
                  marginTop: "12px",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                <Download size={19} />
                Open Download
              </a>
            </div>
          ) : (
            <div
              className="secure-note"
              style={{
                marginTop: "16px",
                color: "#ffb4b4",
              }}
            >
              <X size={17} />
              <span>
                এই product-এর Download URL পাওয়া যায়নি। Admin Panel-এ
                Download URL আবার সেট করো।
              </span>
            </div>
          )}

          <div className="secure-note">
            <ShieldCheck size={17} />
            <span>Payment approved by admin.</span>
          </div>
        </section>
      </main>
    );
  }

  if (status === "rejected") {
    return (
      <main className="payment-page">
        <div className="background-glow glow-one" />
        <div className="background-glow glow-two" />

        <section className="payment-card">
          <div className="brand">
            <div className="brand-mark">R</div>

            <div>
              <h1 style={{ color: "#ffffff" }}>
                RANA PAYMENT
              </h1>

              <p>Payment Status</p>
            </div>
          </div>

          <div className="qr-section">
            <div className="loader-ring">
              <div className="loader-inner">
                <X size={34} />
              </div>
            </div>

            <h2>Payment Rejected</h2>

            <p>
              Your payment could not be verified.
            </p>
          </div>

          <button
            className="paid-button"
            onClick={backToPayment}
          >
            <ArrowLeft size={20} />
            Back to Payment
          </button>
        </section>
      </main>
    );
  }

  if (status === "pending") {
    return (
      <main className="payment-page">
        <div className="background-glow glow-one" />
        <div className="background-glow glow-two" />

        <section className="payment-card">
          <div className="brand">
            <div className="brand-mark">R</div>

            <div>
              <h1 style={{ color: "#ffffff" }}>
                RANA PAYMENT
              </h1>

              <p>Payment Status</p>
            </div>
          </div>

          <div className="product-box">
            <div>
              <span className="eyebrow">
                PAYMENT SUBMITTED
              </span>

              <h2 style={{ color: "#ffffff" }}>
                Payment Pending
              </h2>

              <p
                style={{
                  fontSize: "12px",
                  opacity: 0.5,
                  wordBreak: "break-all",
                }}
              >
                Payment ID:{" "}
                {paymentId || "Loading..."}
              </p>

              <p>
                Your payment request has been submitted.
                Please wait for admin approval.
              </p>
            </div>

            <div className="amount">
              <span>₹</span>
              {product.amount}
            </div>
          </div>

          <div className="expiry">
            <Clock3 size={16} />
            Waiting for admin approval
          </div>

          <div className="qr-section">
            <div className="loader-ring">
              <div className="loader-inner">
                <ShieldCheck size={34} />
              </div>
            </div>

            <h3>Payment Submitted</h3>

            <p>
              After verification, your premium download
              will become available.
            </p>

            <div className="processing-dots">
              <span />
              <span />
              <span />
            </div>
          </div>

          <button
            className="paid-button"
            onClick={backToPayment}
          >
            <ArrowLeft size={20} />
            Back to Payment
          </button>

          <div className="secure-note">
            <ShieldCheck size={17} />

            <span>
              Please don't close this page.
            </span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="payment-page">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <section className="payment-card">
        <div className="brand">
          <div className="brand-mark">R</div>

          <div>
            <h1 style={{ color: "#ffffff" }}>
              RANA PAYMENT
            </h1>

            <p>Secure Payment</p>
          </div>
        </div>

        <div className="product-box">
          <div>
            <span className="eyebrow">
              PAYMENT FOR
            </span>

            <h2>{product.name}</h2>

            <p>{product.description}</p>
          </div>

          <div className="amount">
            <span>₹</span>
            {product.amount}
          </div>
        </div>

        <div className="expiry">
          <Clock3 size={16} />
          Payment link valid for{" "}
          {product.expiryMinutes || 5} minutes
        </div>

        <div className="qr-section">
          <button
            type="button"
            onClick={() => setShowFullQr(true)}
            style={{
              position: "relative",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "min(180px, 52vw)",
                height: "min(180px, 52vw)",
                overflow: "hidden",
                borderRadius: "16px",
                background: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QRCodeSVG
                value={upiLink}
                size={170}
                bgColor="#ffffff"
                fgColor="#111111"
                level="H"
                includeMargin
                style={{
                  display: "block",
                  width: "100%",
                  height: "100%",
                }}
              />
            </div>
          </button>

          <h3>
            Scan & Pay ₹{product.amount}
          </h3>

          <p>Tap the QR to open it larger</p>
        </div>

        {showFullQr && (
          <div
            role="dialog"
            aria-modal="true"
            onClick={() => setShowFullQr(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              background: "rgba(0,0,0,0.82)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(92vw, 390px)",
                borderRadius: "24px",
                padding: "20px",
                background: "#ffffff",
                boxShadow:
                  "0 25px 80px rgba(0,0,0,0.5)",
                textAlign: "center",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() => setShowFullQr(false)}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "none",
                  background: "#111111",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>

              <h3
                style={{
                  color: "#111111",
                  marginTop: "4px",
                }}
              >
                QR CODE
              </h3>

              <p style={{ color: "#555555" }}>
                Scan & Pay ₹{product.amount}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <QRCodeSVG
                  value={upiLink}
                  size={300}
                  bgColor="#ffffff"
                  fgColor="#111111"
                  level="H"
                  includeMargin
                />
              </div>

              <p
                style={{
                  color: "#555555",
                  fontSize: "13px",
                }}
              >
                {product.upiId}
              </p>
            </div>
          </div>
        )}

        <div className="divider">
          <span>OR PAY USING UPI APP</span>
        </div>

        <div className="upi-apps">
          <button
            onClick={openUpi}
            className="upi-app"
          >
            <span className="app-logo google">G</span>
            <span>Google Pay</span>
          </button>

          <button
            onClick={openUpi}
            className="upi-app"
          >
            <span className="app-logo phonepe">पे</span>
            <span>PhonePe</span>
          </button>

          <button
            onClick={openUpi}
            className="upi-app"
          >
            <span className="app-logo paytm">P</span>
            <span>Paytm</span>
          </button>

          <button
            onClick={openUpi}
            className="upi-app"
          >
            <span className="app-logo bhim">B</span>
            <span>BHIM</span>
          </button>
        </div>

        <div className="upi-id-box">
          <div>
            <span>UPI ID</span>

            <strong>{product.upiId}</strong>
          </div>

          <button onClick={copyUpi}>
            {copied ? (
              <Check size={18} />
            ) : (
              <Copy size={18} />
            )}

            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="secure-note">
          <Smartphone size={17} />

          <span>
            Your payment is processed securely through UPI.
          </span>
        </div>
      </section>
    </main>
  );
}
