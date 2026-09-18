import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { useEffect, useState } from "react";
import {
  Check,
  X,
  Clock3,
  RefreshCw,
  Trash2,
  Plus,
  Copy,
  Package,
  Link2,
  CreditCard,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

const CLEANUP_TIME = 5 * 60 * 1000;
const CLEANUP_INTERVAL = 10 * 1000;

const emptyProduct = {
  name: "",
  description: "",
  amount: "",
  upiId: "alwaysadmin-1@okhdfcbank",
  downloadUrl: "",
  expiryMinutes: 5,
};

export default function Admin() {
  const [activeSection, setActiveSection] = useState("links");
  const [payments, setPayments] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [showProductForm, setShowProductForm] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        list.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

        setProducts(list);
        setProductLoading(false);
      },
      (error) => {
        console.error("Product listener error:", error);
        setProductLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "payments"),
      (snapshot) => {
        const list = snapshot.docs.map((paymentDoc) => ({
          id: paymentDoc.id,
          ...paymentDoc.data(),
        }));

        list.sort((a, b) => {
          const order = {
            pending: 0,
            approved: 1,
            rejected: 2,
          };

          const statusA = order[a.status] ?? 99;
          const statusB = order[b.status] ?? 99;

          if (statusA !== statusB) {
            return statusA - statusB;
          }

          const aTime =
            a.createdAt?.toMillis?.() ||
            a.approvedAt?.toMillis?.() ||
            a.rejectedAt?.toMillis?.() ||
            0;

          const bTime =
            b.createdAt?.toMillis?.() ||
            b.approvedAt?.toMillis?.() ||
            b.rejectedAt?.toMillis?.() ||
            0;

          return bTime - aTime;
        });

        setPayments(list);
        setLoading(false);
      },
      (error) => {
        console.error("Payment listener error:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Only finished requests are automatically cleaned.
  // Pending requests remain visible so the admin has time to verify them.
  useEffect(() => {
    const cleanupFinishedPayments = async () => {
      const now = Date.now();

      for (const payment of payments) {
        let lifecycleStart = 0;

        if (payment.status === "approved") {
          lifecycleStart = payment.approvedAt?.toMillis?.() || 0;
        } else if (payment.status === "rejected") {
          lifecycleStart = payment.rejectedAt?.toMillis?.() || 0;
        } else {
          continue;
        }

        if (
          lifecycleStart &&
          now >= lifecycleStart + CLEANUP_TIME
        ) {
          try {
            await deleteDoc(
              doc(db, "payments", payment.id)
            );
          } catch (error) {
            console.error(
              "Auto delete error:",
              error
            );
          }
        }
      }
    };

    const interval = setInterval(
      cleanupFinishedPayments,
      CLEANUP_INTERVAL
    );

    return () => clearInterval(interval);
  }, [payments]);

  const updateProductForm = (field, value) => {
    setProductForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const createProduct = async (event) => {
    event.preventDefault();

    const amount = Number(productForm.amount);

    if (!productForm.name.trim()) {
      alert("Product name দিন।");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Valid UPI amount দিন।");
      return;
    }

    if (!productForm.upiId.trim()) {
      alert("UPI ID দিন।");
      return;
    }

    if (!productForm.downloadUrl.trim()) {
      alert("Download URL দিন।");
      return;
    }

    const expiryMinutes =
      Number(productForm.expiryMinutes) > 0
        ? Number(productForm.expiryMinutes)
        : 5;

    setSavingProduct(true);

    try {
      await addDoc(collection(db, "products"), {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        amount,
        upiId: productForm.upiId.trim(),
        downloadUrl: productForm.downloadUrl.trim(),
        expiryMinutes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        active: true,
      });

      setProductForm(emptyProduct);
      setShowProductForm(false);
    } catch (error) {
      console.error("Product create error:", error);
      alert(
        "Product create করা যায়নি। Firebase Rules/permission check করো।"
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const getProductLink = (productId) => {
    return `${window.location.origin}/?product=${encodeURIComponent(
      productId
    )}`;
  };

  const copyProductLink = async (productId) => {
    const link = getProductLink(productId);

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(productId);

      setTimeout(() => {
        setCopiedId("");
      }, 1800);
    } catch {
      alert("Link copy করা যায়নি।");
    }
  };

  const toggleProduct = async (product) => {
    try {
      await updateDoc(
        doc(db, "products", product.id),
        {
          active: product.active === false,
          updatedAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error("Product update error:", error);
      alert("Product status change করা যায়নি।");
    }
  };

  const deleteProduct = async (productId) => {
    if (
      !window.confirm(
        "এই product এবং তার generated link permanently delete করতে চাও?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "products", productId)
      );
    } catch (error) {
      console.error("Product delete error:", error);
      alert("Product delete করা যায়নি।");
    }
  };

  const changeStatus = async (
    paymentId,
    newStatus
  ) => {
    try {
      const paymentRef = doc(
        db,
        "payments",
        paymentId
      );

      if (newStatus === "approved") {
        await updateDoc(paymentRef, {
          status: "approved",
          approvedAt: serverTimestamp(),
        });
      }

      if (newStatus === "rejected") {
        await updateDoc(paymentRef, {
          status: "rejected",
          rejectedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error(
        "Status update error:",
        error
      );
      alert(
        "Payment status update করা যায়নি।"
      );
    }
  };

  const manuallyDelete = async (paymentId) => {
    if (
      !window.confirm(
        "এই payment request permanently delete করতে চাও?"
      )
    ) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "payments", paymentId)
      );
    } catch (error) {
      console.error(
        "Manual delete error:",
        error
      );
      alert("Payment delete করা যায়নি।");
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp?.toDate) {
      return "Just now";
    }

    return timestamp
      .toDate()
      .toLocaleString();
  };

  const getRequestAge = (payment) => {
    const created =
      payment.createdAt?.toMillis?.() || 0;

    if (!created) {
      return null;
    }

    return Date.now() - created;
  };

  const getPendingTimeLeft = (payment) => {
    const age = getRequestAge(payment);

    if (age === null) {
      return "Waiting";
    }

    const remaining =
      CLEANUP_TIME - age;

    if (remaining <= 0) {
      return "Expired";
    }

    const seconds = Math.ceil(
      remaining / 1000
    );

    const minutes = Math.floor(
      seconds / 60
    );

    const secs = seconds % 60;

    return `${minutes}:${String(
      secs
    ).padStart(2, "0")} left`;
  };

  const pendingPayments =
    payments.filter(
      (item) => item.status === "pending"
    );

  const finishedPayments =
    payments.filter(
      (item) => item.status !== "pending"
    );

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "50px",
    borderRadius: "14px",
    border:
      "1px solid rgba(255,255,255,0.11)",
    background:
      "rgba(255,255,255,0.055)",
    color: "#ffffff",
    padding: "0 15px",
    outline: "none",
    fontSize: "14px",
  };

  const labelStyle = {
    display: "block",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    opacity: 0.62,
    marginBottom: "8px",
    textTransform: "uppercase",
  };

  const sectionButton = (active) => ({
    flex: 1,
    minWidth: "220px",
    minHeight: "62px",
    borderRadius: "18px",
    border: active
      ? "1px solid rgba(255,255,255,0.20)"
      : "1px solid rgba(255,255,255,0.08)",
    background: active
      ? "rgba(255,255,255,0.10)"
      : "rgba(255,255,255,0.035)",
    color: "#ffffff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    fontWeight: 800,
    fontSize: "14px",
    boxShadow: active
      ? "0 12px 35px rgba(0,0,0,0.18)"
      : "none",
  });

  return (
    <main className="payment-page">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <section
        className="payment-card"
        style={{
          width: "min(100% - 24px, 1000px)",
          maxWidth: "1000px",
          padding: "22px",
        }}
      >
        {/* HEADER */}
        <div className="brand">
          <div className="brand-mark">R</div>

          <div>
            <h1 style={{ color: "#ffffff" }}>
              RANA PAYMENT
            </h1>
            <p>Premium Admin Console</p>
          </div>
        </div>

        {/* TWO MAIN SECTIONS */}
        <div
          style={{
            marginTop: "24px",
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() =>
              setActiveSection("links")
            }
            style={sectionButton(
              activeSection === "links"
            )}
          >
            <Link2 size={20} />
            <span>
              Generate Payment Link
              <small
                style={{
                  display: "block",
                  opacity: 0.45,
                  fontWeight: 500,
                  marginTop: "3px",
                }}
              >
                Create & manage products
              </small>
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              setActiveSection("requests")
            }
            style={sectionButton(
              activeSection === "requests"
            )}
          >
            <CreditCard size={20} />
            <span>
              Payment Requests
              <small
                style={{
                  display: "block",
                  opacity: 0.45,
                  fontWeight: 500,
                  marginTop: "3px",
                }}
              >
                Approve or reject payments
              </small>
            </span>

            {pendingPayments.length > 0 && (
              <span
                style={{
                  minWidth: "26px",
                  height: "26px",
                  padding: "0 7px",
                  borderRadius: "999px",
                  background:
                    "rgba(255,255,255,0.13)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                }}
              >
                {pendingPayments.length}
              </span>
            )}
          </button>
        </div>

        {/* SECTION 1 */}
        {activeSection === "links" && (
          <div
            style={{
              marginTop: "18px",
              padding: "20px",
              borderRadius: "24px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))",
              border:
                "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span className="eyebrow">
                  SECTION 01
                </span>

                <h2
                  style={{
                    color: "#ffffff",
                    margin: "7px 0",
                  }}
                >
                  Generate Payment Link
                </h2>

                <p style={{ margin: 0 }}>
                  প্রতিটি product-এর আলাদা amount,
                  UPI ID, QR এবং download URL থাকবে।
                </p>
              </div>

              <button
                className="paid-button"
                type="button"
                onClick={() =>
                  setShowProductForm(
                    (value) => !value
                  )
                }
                style={{
                  minHeight: "48px",
                  padding: "0 18px",
                }}
              >
                <Plus size={18} />
                New Product
              </button>
            </div>

            {showProductForm && (
              <form
                onSubmit={createProduct}
                style={{
                  marginTop: "20px",
                  padding: "18px",
                  borderRadius: "20px",
                  background:
                    "rgba(0,0,0,0.18)",
                  border:
                    "1px solid rgba(255,255,255,0.07)",
                  display: "grid",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit,minmax(220px,1fr))",
                    gap: "14px",
                  }}
                >
                  <div>
                    <label style={labelStyle}>
                      Product Name
                    </label>
                    <input
                      style={inputStyle}
                      value={productForm.name}
                      onChange={(e) =>
                        updateProductForm(
                          "name",
                          e.target.value
                        )
                      }
                      placeholder="Premium File"
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      UPI Amount
                    </label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="1"
                      step="0.01"
                      value={productForm.amount}
                      onChange={(e) =>
                        updateProductForm(
                          "amount",
                          e.target.value
                        )
                      }
                      placeholder="100"
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      UPI ID
                    </label>
                    <input
                      style={inputStyle}
                      value={productForm.upiId}
                      onChange={(e) =>
                        updateProductForm(
                          "upiId",
                          e.target.value
                        )
                      }
                      placeholder="alwaysadmin-1@okhdfcbank"
                      required
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Link Expiry
                    </label>
                    <input
                      style={inputStyle}
                      type="number"
                      min="1"
                      value={
                        productForm.expiryMinutes
                      }
                      onChange={(e) =>
                        updateProductForm(
                          "expiryMinutes",
                          e.target.value
                        )
                      }
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Download URL
                  </label>
                  <input
                    style={inputStyle}
                    type="url"
                    value={
                      productForm.downloadUrl
                    }
                    onChange={(e) =>
                      updateProductForm(
                        "downloadUrl",
                        e.target.value
                      )
                    }
                    placeholder="https://example.com/file.zip"
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Description
                  </label>
                  <textarea
                    style={{
                      ...inputStyle,
                      padding: "14px",
                      minHeight: "90px",
                      resize: "vertical",
                    }}
                    value={
                      productForm.description
                    }
                    onChange={(e) =>
                      updateProductForm(
                        "description",
                        e.target.value
                      )
                    }
                    placeholder="Premium download description..."
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    justifyContent:
                      "flex-end",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(
                        false
                      );
                      setProductForm(
                        emptyProduct
                      );
                    }}
                    style={{
                      minHeight: "48px",
                      padding: "0 18px",
                      borderRadius: "14px",
                      border:
                        "1px solid rgba(255,255,255,0.12)",
                      background:
                        "rgba(255,255,255,0.04)",
                      color: "#ffffff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="paid-button"
                    disabled={savingProduct}
                    style={{
                      minHeight: "48px",
                      padding: "0 18px",
                    }}
                  >
                    <Check size={18} />
                    {savingProduct
                      ? "Creating..."
                      : "Generate Link"}
                  </button>
                </div>
              </form>
            )}

            <div
              style={{
                display: "grid",
                gap: "12px",
                marginTop: "18px",
              }}
            >
              {productLoading && (
                <div className="secure-note">
                  <RefreshCw size={16} />
                  Loading products...
                </div>
              )}

              {!productLoading &&
                products.length === 0 && (
                  <div className="secure-note">
                    <Package size={17} />
                    No products yet.
                  </div>
                )}

              {products.map((product) => {
                const link =
                  getProductLink(
                    product.id
                  );

                return (
                  <div
                    key={product.id}
                    style={{
                      padding: "18px",
                      borderRadius: "20px",
                      background:
                        "rgba(255,255,255,0.035)",
                      border:
                        "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "15px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span className="eyebrow">
                          {product.active ===
                          false
                            ? "DISABLED"
                            : "ACTIVE PRODUCT"}
                        </span>

                        <h3
                          style={{
                            color:
                              "#ffffff",
                            margin:
                              "7px 0",
                          }}
                        >
                          {product.name}
                        </h3>

                        <p
                          style={{
                            margin:
                              "5px 0",
                          }}
                        >
                          ₹{product.amount}{" "}
                          • {product.upiId}
                        </p>

                        <p
                          style={{
                            fontSize:
                              "11px",
                            opacity:
                              0.48,
                            wordBreak:
                              "break-all",
                            margin:
                              "7px 0",
                          }}
                        >
                          Link: {link}
                        </p>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          gap: "8px",
                          alignItems:
                            "flex-start",
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            copyProductLink(
                              product.id
                            )
                          }
                          style={{
                            minHeight:
                              "42px",
                            padding:
                              "0 12px",
                            borderRadius:
                              "12px",
                            border:
                              "1px solid rgba(255,255,255,0.10)",
                            background:
                              "rgba(255,255,255,0.05)",
                            color:
                              "#ffffff",
                            fontWeight:
                              700,
                            cursor:
                              "pointer",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "6px",
                          }}
                        >
                          {copiedId ===
                          product.id ? (
                            <Check
                              size={16}
                            />
                          ) : (
                            <Copy
                              size={16}
                            />
                          )}

                          {copiedId ===
                          product.id
                            ? "Copied"
                            : "Copy Link"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            toggleProduct(
                              product
                            )
                          }
                          style={{
                            minHeight:
                              "42px",
                            padding:
                              "0 12px",
                            borderRadius:
                              "12px",
                            border:
                              "1px solid rgba(255,255,255,0.10)",
                            background:
                              "rgba(255,255,255,0.05)",
                            color:
                              "#ffffff",
                            fontWeight:
                              700,
                            cursor:
                              "pointer",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "5px",
                          }}
                        >
                          {product.active ===
                          false ? (
                            <ToggleLeft
                              size={16}
                            />
                          ) : (
                            <ToggleRight
                              size={16}
                            />
                          )}

                          {product.active ===
                          false
                            ? "Enable"
                            : "Disable"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteProduct(
                              product.id
                            )
                          }
                          style={{
                            minHeight:
                              "42px",
                            padding:
                              "0 12px",
                            borderRadius:
                              "12px",
                            border:
                              "1px solid rgba(255,80,80,0.22)",
                            background:
                              "rgba(255,80,80,0.08)",
                            color:
                              "#ff8b8b",
                            fontWeight:
                              700,
                            cursor:
                              "pointer",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "5px",
                          }}
                        >
                          <Trash2
                            size={15}
                          />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 2 */}
        {activeSection === "requests" && (
          <div
            style={{
              marginTop: "18px",
              padding: "20px",
              borderRadius: "24px",
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))",
              border:
                "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span className="eyebrow">
                  SECTION 02
                </span>

                <h2
                  style={{
                    color: "#ffffff",
                    margin: "7px 0",
                  }}
                >
                  Payment Requests
                </h2>

                <p style={{ margin: 0 }}>
                  Customer payment verify করে
                  Approve অথবা Reject করো।
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px",
                    background:
                      "rgba(255,255,255,0.06)",
                    border:
                      "1px solid rgba(255,255,255,0.08)",
                    textAlign: "center",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#ffffff",
                      fontSize: "20px",
                    }}
                  >
                    {pendingPayments.length}
                  </strong>
                  <span
                    style={{
                      fontSize: "10px",
                      opacity: 0.5,
                    }}
                  >
                    PENDING
                  </span>
                </div>

                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "14px",
                    background:
                      "rgba(255,255,255,0.06)",
                    border:
                      "1px solid rgba(255,255,255,0.08)",
                    textAlign: "center",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#ffffff",
                      fontSize: "20px",
                    }}
                  >
                    {payments.length}
                  </strong>
                  <span
                    style={{
                      fontSize: "10px",
                      opacity: 0.5,
                    }}
                  >
                    TOTAL
                  </span>
                </div>
              </div>
            </div>

            {loading && (
              <div
                className="secure-note"
                style={{
                  marginTop: "18px",
                }}
              >
                <RefreshCw size={16} />
                Loading payment requests...
              </div>
            )}

            {!loading &&
              payments.length === 0 && (
                <div
                  className="secure-note"
                  style={{
                    marginTop: "18px",
                  }}
                >
                  <CreditCard size={17} />
                  এখনো কোনো payment request নেই।
                </div>
              )}

            {!loading &&
              pendingPayments.length === 0 &&
              payments.length > 0 && (
                <div
                  style={{
                    marginTop: "18px",
                    padding: "18px",
                    borderRadius: "18px",
                    background:
                      "rgba(255,255,255,0.035)",
                    border:
                      "1px solid rgba(255,255,255,0.07)",
                    textAlign: "center",
                  }}
                >
                  <Check
                    size={26}
                    style={{
                      marginBottom: "6px",
                    }}
                  />

                  <h3
                    style={{
                      color: "#ffffff",
                      margin:
                        "4px 0",
                    }}
                  >
                    No Pending Requests
                  </h3>

                  <p
                    style={{
                      margin: 0,
                    }}
                  >
                    নতুন customer payment
                    request এখানে আসবে।
                  </p>
                </div>
              )}

            <div
              style={{
                display: "grid",
                gap: "12px",
                marginTop: "18px",
              }}
            >
              {pendingPayments.map(
                (payment) => (
                  <article
                    key={payment.id}
                    style={{
                      padding: "18px",
                      borderRadius: "20px",
                      background:
                        "rgba(255,255,255,0.045)",
                      border:
                        "1px solid rgba(255,255,255,0.10)",
                      boxShadow:
                        "0 15px 45px rgba(0,0,0,0.14)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: "15px",
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <span className="eyebrow">
                          PENDING PAYMENT
                        </span>

                        <h3
                          style={{
                            color:
                              "#ffffff",
                            margin:
                              "7px 0",
                          }}
                        >
                          {payment.productName ||
                            "Payment"}
                        </h3>

                        <div
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            gap: "5px",
                            padding:
                              "8px 12px",
                            borderRadius:
                              "12px",
                            background:
                              "rgba(255,255,255,0.07)",
                            color:
                              "#ffffff",
                            fontWeight:
                              800,
                            fontSize:
                              "18px",
                            marginBottom:
                              "10px",
                          }}
                        >
                          ₹
                          {payment.amount}
                        </div>

                        <p
                          style={{
                            fontSize:
                              "12px",
                            wordBreak:
                              "break-all",
                            margin:
                              "5px 0",
                          }}
                        >
                          Payment ID:{" "}
                          {payment.id}
                        </p>

                        <p
                          style={{
                            fontSize:
                              "13px",
                            margin:
                              "5px 0",
                          }}
                        >
                          UPI:{" "}
                          {payment.upiId ||
                            "N/A"}
                        </p>

                        <p
                          style={{
                            fontSize:
                              "11px",
                            opacity:
                              0.48,
                            margin:
                              "5px 0",
                          }}
                        >
                          Created:{" "}
                          {formatTime(
                            payment.createdAt
                          )}
                        </p>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          flexDirection:
                            "column",
                          alignItems:
                            "flex-end",
                          gap: "7px",
                        }}
                      >
                        <span
                          style={{
                            padding:
                              "7px 12px",
                            borderRadius:
                              "999px",
                            background:
                              "rgba(255,255,255,0.08)",
                            fontSize:
                              "10px",
                            fontWeight:
                              800,
                            letterSpacing:
                              "0.06em",
                          }}
                        >
                          PENDING
                        </span>

                        <span
                          style={{
                            fontSize:
                              "12px",
                            opacity:
                              0.65,
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "5px",
                          }}
                        >
                          <Clock3
                            size={14}
                          />
                          {getPendingTimeLeft(
                            payment
                          )}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit,minmax(150px,1fr))",
                        gap: "10px",
                        marginTop:
                          "15px",
                      }}
                    >
                      <button
                        className="paid-button"
                        type="button"
                        onClick={() =>
                          changeStatus(
                            payment.id,
                            "approved"
                          )
                        }
                        style={{
                          minHeight:
                            "52px",
                        }}
                      >
                        <Check
                          size={18}
                        />
                        Approve Payment
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          changeStatus(
                            payment.id,
                            "rejected"
                          )
                        }
                        style={{
                          minHeight:
                            "52px",
                          borderRadius:
                            "14px",
                          border:
                            "1px solid rgba(255,255,255,0.12)",
                          background:
                            "rgba(255,255,255,0.04)",
                          color:
                            "#ffffff",
                          fontWeight:
                            800,
                          cursor:
                            "pointer",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          gap: "7px",
                        }}
                      >
                        <X size={18} />
                        Reject
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        manuallyDelete(
                          payment.id
                        )
                      }
                      style={{
                        width: "100%",
                        minHeight: "42px",
                        marginTop: "10px",
                        borderRadius: "12px",
                        border:
                          "1px solid rgba(255,80,80,0.16)",
                        background:
                          "rgba(255,80,80,0.045)",
                        color: "#ff9a9a",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent:
                          "center",
                        gap: "7px",
                      }}
                    >
                      <Trash2 size={15} />
                      Delete Request
                    </button>
                  </article>
                )
              )}
            </div>

            {finishedPayments.length > 0 && (
              <div
                style={{
                  marginTop: "22px",
                  paddingTop: "18px",
                  borderTop:
                    "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span className="eyebrow">
                  RECENT FINISHED REQUESTS
                </span>

                <div
                  style={{
                    display: "grid",
                    gap: "9px",
                    marginTop: "10px",
                  }}
                >
                  {finishedPayments
                    .slice(0, 10)
                    .map((payment) => (
                      <div
                        key={payment.id}
                        style={{
                          padding:
                            "13px 14px",
                          borderRadius:
                            "14px",
                          background:
                            "rgba(255,255,255,0.03)",
                          border:
                            "1px solid rgba(255,255,255,0.06)",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <strong
                            style={{
                              color:
                                "#ffffff",
                              fontSize:
                                "13px",
                            }}
                          >
                            {payment.productName ||
                              "Payment"}{" "}
                            • ₹
                            {payment.amount}
                          </strong>

                          <p
                            style={{
                              margin:
                                "4px 0 0",
                              fontSize:
                                "10px",
                              opacity:
                                0.45,
                              wordBreak:
                                "break-all",
                            }}
                          >
                            {payment.id}
                          </p>
                        </div>

                        <span
                          style={{
                            fontSize:
                              "10px",
                            fontWeight:
                              800,
                            textTransform:
                              "uppercase",
                            opacity:
                              0.7,
                          }}
                        >
                          {payment.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div
          className="secure-note"
          style={{
            marginTop: "18px",
            justifyContent: "center",
          }}
        >
          <ExternalLink size={15} />
          <span>
            RANA PAYMENT • Admin Console
          </span>
        </div>
      </section>
    </main>
  );
}
