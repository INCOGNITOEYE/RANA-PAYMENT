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

  const [paymentId, setPaymentId] = useState(
    sessionStorage.getItem("paymentId")
  );

  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const creatingRequest = useRef(false);

  const isAdmin = window.location.hash === "#admin";

  const productId = new URLSearchParams(
    window.location.search
  ).get("product");

  /* =========================
     LOAD PRODUCT
     ========================= */

  useEffect(() => {
    if (isAdmin) return;

    const loadProduct = async () => {
      setProductLoading(true);

      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

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

  /* =========================
     CREATE / RESTORE PAYMENT
     ========================= */

  useEffect(() => {
    if (isAdmin || !product || !productId) return;

    const createOrRestoreRequest = async () => {
      if (creatingRequest.current) return;

      creatingRequest.current = true;

      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }

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
                setStatus("verified");
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
              product.merchantName ||
              "RANA PAYMENT",
            productName: product.name,
            description: product.description || "",
            downloadUrl: product.downloadUrl || "",
            expiryMinutes:
              Number(product.expiryMinutes) || 5,
            createdAt: serverTimestamp(),
          }
        );

        sessionStorage.setItem(
          "paymentId",
          docRef.id
        );

        sessionStorage.setItem(
          "paymentProductId",
          product.id
        );

        sessionStorage.removeItem(
          "paymentStarted"
        );

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

  /* =========================
     LIVE PAYMENT STATUS
     ========================= */

  useEffect(() => {
    if (!paymentId || isAdmin) return;

    const paymentRef = doc(
      db,
      "payments",
      paymentId
    );

    const unsubscribe = onSnapshot(
      paymentRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          sessionStorage.removeItem("paymentId");
          sessionStorage.removeItem("paymentProductId");
          sessionStorage.removeItem("paymentStarted");

          setPaymentId(null);
          setStatus("payment");
          return;
        }

        const data = snapshot.data();

        if (data.status === "approved") {
          setStatus("verified");
        } else if (data.status === "rejected") {
          setStatus("rejected");
        } else if (data.status === "pending") {
          if (
            sessionStorage.getItem(
              "paymentStarted"
            ) === "true"
          ) {
            setStatus("pending");
          } else {
            setStatus("payment");
          }
        }
      },
      (error) => {
        console.error(
          "Payment status error:",
          error
        );
      }
    );

    return () => unsubscribe();
  }, [paymentId, isAdmin]);

  /* =========================
     VISIBILITY
     ========================= */

  useEffect(() => {
    if (isAdmin) return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;

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

  /* =========================
     COPY UPI
     ========================= */

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

  /* =========================
     OPEN UPI
     ========================= */

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

  /* =========================
     BACK
     ========================= */

  const backToPayment = () => {
    sessionStorage.removeItem(
      "paymentStarted"
    );

    setStatus("payment");
  };

  /* =========================
     ADMIN
     ========================= */

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

  /* =========================
     LOADING
     ========================= */

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

  /* =========================
     LINK UNAVAILABLE
     ========================= */

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

  /* =========================
     UPI LINK
     ========================= */

  const upiLink =
    `upi://pay?pa=${encodeURIComponent(
      product.upiId
    )}` +
    `&pn=${encodeURIComponent(
      product.merchantName ||
        "RANA PAYMENT"
    )}` +
    `&am=${Number(product.amount).toFixed(2)}` +
    `&cu=INR`;

  /* =========================
     VERIFIED
     ========================= */

  if (status === "verified") {
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
              Your payment has been
              verified successfully.
            </p>

            <div className="processing-dots">
              <span />
              <span />
              <span />
            </div>
          </div>

          {product.downloadUrl ? (
            <a
              className="paid-button"
              href={product.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                textDecoration: "none",
                justifyContent: "center",
              }}
            >
              <Download size={19} />
              Download Premium File
            </a>
          ) : (
            <button
              className="paid-button"
              onClick={() =>
                alert(
                  "Admin এখনও এই product-এর Download URL set করেননি।"
                )
              }
            >
              <Download size={19} />
              Download Premium File
            </button>
          )}

          <div className="secure-note">
            <ShieldCheck size={17} />

            <span>
              Payment approved by admin.
            </span>
          </div>
        </section>
      </main>
    );
  }

  /* =========================
     REJECTED
     ========================= */

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
              Your payment could not
              be verified.
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

  /* =========================
     PENDING
     ========================= */

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
                Your payment request has
                been submitted. Please wait
                for admin approval.
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
              After verification, your
              premium download will become
              available.
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

  /* =========================
     PAYMENT PAGE
     ========================= */

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

            <p>
              {product.description}
            </p>
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

        {/* =========================
           VISIBLE CLICKABLE QR
           ========================= */}

        <div className="qr-section">
          <button
            type="button"
            onClick={() => setShowFullQr(true)}
            aria-label="Open QR code"
            style={{
              position: "relative",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              display: "inline-flex",
              borderRadius: "18px",
              overflow: "hidden",
              WebkitTapHighlightColor:
                "transparent",
            }}
          >
            <div
              style={{
                background: "#ffffff",
                borderRadius: "18px",
                padding: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow:
                  "0 18px 55px rgba(0,0,0,0.28)",
              }}
            >
              <QRCodeSVG
                value={upiLink}
                size={220}
                bgColor="#ffffff"
                fgColor="#111111"
                level="H"
                includeMargin
                style={{
                  display: "block",
                  width: "220px",
                  height: "220px",
                }}
              />
            </div>
          </button>

          <h3>
            Scan & Pay ₹{product.amount}
          </h3>
        </div>

        {/* =========================
           FULL QR MODAL
           ========================= */}

        {showFullQr && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Full QR code"
            onClick={() => setShowFullQr(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              background:
                "rgba(0,0,0,0.84)",
              backdropFilter:
                "blur(12px)",
              WebkitBackdropFilter:
                "blur(12px)",
            }}
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                width: "min(92vw, 390px)",
                borderRadius: "24px",
                padding: "22px",
                background: "#ffffff",
                boxShadow:
                  "0 25px 80px rgba(0,0,0,0.55)",
                textAlign: "center",
                position: "relative",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setShowFullQr(false)
                }
                aria-label="Close QR"
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
                  zIndex: 2,
                }}
              >
                <X size={20} />
              </button>

              <h3
                style={{
                  color: "#111111",
                  margin:
                    "4px 45px 8px 0",
                  textAlign: "left",
                }}
              >
                QR CODE
              </h3>

              <p
                style={{
                  color: "#555555",
                  marginTop: 0,
                }}
              >
                Scan & Pay ₹{product.amount}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "center",
                  alignItems: "center",
                  overflow: "auto",
                }}
              >
                <QRCodeSVG
                  value={upiLink}
                  size={300}
                  bgColor="#ffffff"
                  fgColor="#111111"
                  level="H"
                  includeMargin
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    height: "auto",
                  }}
                />
              </div>

              <p
                style={{
                  color: "#555555",
                  fontSize: "13px",
                  marginBottom: 0,
                  wordBreak:
                    "break-word",
                }}
              >
                {product.upiId}
              </p>
            </div>
          </div>
        )}

        {/* =========================
           UPI ID
           ========================= */}

        <div className="upi-id-box">
          <div>
            <span>UPI ID</span>

            <strong>
              {product.upiId}
            </strong>
          </div>

          <button
            type="button"
            onClick={copyUpi}
          >
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
            Your payment is processed
            securely through UPI.
          </span>
        </div>
      </section>
    </main>
  );
}
