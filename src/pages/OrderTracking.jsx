import { useState } from "react";
import { useLocation } from "react-router-dom";
import { API_URL } from "../api";

const STATUS_LABELS = {
  Received: "Pranuar",
  Confirmed: "Konfirmuar",
  SentToCourier: "Dërguar te kurieri",
  Delivered: "Dorëzuar",
  Cancelled: "Anuluar",
};
const STATUS_STEPS = ["Received", "Confirmed", "SentToCourier", "Delivered"];

async function request(path, body) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Nuk mund të lidhemi me serverin. Provo përsëri.");
  }

  const text = await response.text();
  let result = {};
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      result = { message: text };
    }
  }
  if (!response.ok) {
    const error = new Error(
      result.message || `Gabim nga serveri (${response.status}).`,
    );
    error.status = response.status;
    throw error;
  }
  return result;
}

const money = (amount) =>
  new Intl.NumberFormat("sq-XK", { style: "currency", currency: "EUR" }).format(
    amount,
  );

const formatDate = (value, includeTime = true) =>
  new Intl.DateTimeFormat("sq-XK", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" } : {}),
  }).format(new Date(value));

export default function OrderTracking() {
  const location = useLocation();
  const [firstName, setFirstName] = useState(location.state?.firstName || "");
  const [lastName, setLastName] = useState(location.state?.lastName || "");
  const [email, setEmail] = useState(location.state?.email || "");
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const track = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    setOrder(null);
    setOrders([]);
    try {
      const result = await request("/api/orders/track", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      setOrders(result);
      if (result.length === 1) setOrder(result[0]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (!window.confirm("A dëshiron vërtet ta anulosh këtë porosi?")) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await request(
        `/api/orders/${encodeURIComponent(order.orderNumber)}/cancel`,
        { email: email.trim() },
      );
      setOrder((current) => ({ ...current, status: result.status }));
      setOrders((current) =>
        current.map((item) =>
          item.orderNumber === result.orderNumber
            ? { ...item, status: result.status }
            : item,
        ),
      );
      setNotice("Porosia u anulua me sukses.");
    } catch (requestError) {
      setError(requestError.message);
      if (requestError.status === 409) {
        try {
          const currentOrders = await request("/api/orders/track", {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
          });
          setOrders(currentOrders);
          setOrder(
            currentOrders.find(
              (item) => item.orderNumber === order.orderNumber,
            ) || null,
          );
        } catch (refreshError) {
          setError(refreshError.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const activeStep = STATUS_STEPS.indexOf(order?.status);

  return (
    <section className="wrap order-tracking">
      <span className="eyebrow">Maison · Porositë</span>
      <h1>Gjurmo porosinë</h1>
      <p className="tracking-intro">
        Shkruaj emrin, mbiemrin dhe email-in që përdore gjatë blerjes për të
        parë porositë e tua.
      </p>
      <form className="tracking-form" onSubmit={track}>
        <label>
          Emri
          <input
            autoComplete="given-name"
            maxLength={80}
            onChange={(event) => setFirstName(event.target.value)}
            required
            value={firstName}
          />
        </label>
        <label>
          Mbiemri
          <input
            autoComplete="family-name"
            maxLength={80}
            onChange={(event) => setLastName(event.target.value)}
            required
            value={lastName}
          />
        </label>
        <label>
          Email-i i porosisë
          <input
            autoComplete="email"
            maxLength={254}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <button className="btn" disabled={loading}>
          {loading ? "Duke kërkuar..." : "Gjurmo"}
        </button>
      </form>
      {error && (
        <p className="tracking-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="tracking-notice" role="status">
          {notice}
        </p>
      )}

      {orders.length > 1 && !order && (
        <div className="tracking-order-choices" aria-label="Zgjidh porosinë">
          <h2>U gjetën disa porosi. Zgjidh cilën dëshiron të shohësh:</h2>
          {orders.map((item) => (
            <button
              className="tracking-order-choice"
              key={item.orderNumber}
              onClick={() => setOrder(item)}
              type="button">
              <span>{formatDate(item.createdAtUtc)}</span>
              <strong>{STATUS_LABELS[item.status] || item.status}</strong>
              <span>{money(item.total)}</span>
            </button>
          ))}
        </div>
      )}

      {order && (
        <article className="tracking-result" aria-live="polite">
          <div className="tracking-result-heading">
            <div>
              <span className="eyebrow">
                {order.firstName} {order.lastName}
              </span>
              <h2>{STATUS_LABELS[order.status] || order.status}</h2>
            </div>
            <time dateTime={order.createdAtUtc}>
              {formatDate(order.createdAtUtc)}
            </time>
          </div>
          {order.status === "Cancelled" ? (
            <p className="tracking-cancelled">Kjo porosi është anuluar.</p>
          ) : (
            <ol className="tracking-steps">
              {STATUS_STEPS.map((status, index) => (
                <li
                  className={index <= activeStep ? "complete" : ""}
                  key={status}>
                  <span aria-hidden="true">
                    {index < activeStep ? "✓" : index + 1}
                  </span>
                  {STATUS_LABELS[status]}
                </li>
              ))}
            </ol>
          )}
          <p className="tracking-disclaimer">
            Këtu shfaqet statusi i porosisë; lokacioni i drejtpërdrejtë i
            dërgesës nuk ofrohet nga sistemi.
          </p>
          <ul className="tracking-items">
            {order.items.map((item, index) => (
              <li key={`${item.productName}-${item.size}-${item.color}-${index}`}>
                <span>
                  {item.productName} · {item.size} · {item.color} × {item.quantity}
                </span>
              </li>
            ))}
          </ul>
          <div className="tracking-total">
            <span>Totali</span>
            <strong>{money(order.total)}</strong>
          </div>
          {order.status === "Received" && (
            <button
              className="btn cancel-order"
              disabled={loading}
              onClick={cancel}
              type="button">
              Anulo porosinë
            </button>
          )}
        </article>
      )}
    </section>
  );
}
