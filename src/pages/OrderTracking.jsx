import { useState } from "react";
import { useLocation } from "react-router-dom";
import { API_URL } from "../api";

const STATUS_LABELS = {
  Received: "Received",
  Confirmed: "Confirmed",
  SentToCourier: "Sent to courier",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
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
    throw new Error("Unable to connect to the server. Please try again.");
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
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
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
      setNotice("The order was cancelled successfully.");
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
      <span className="eyebrow">Maison · Orders</span>
      <h1>Track order</h1>
      <p className="tracking-intro">
        Enter the first name, last name and email used during purchase to view
        your orders.
      </p>
      <form className="tracking-form" onSubmit={track}>
        <label>
          First name
          <input
            autoComplete="given-name"
            maxLength={80}
            onChange={(event) => setFirstName(event.target.value)}
            required
            value={firstName}
          />
        </label>
        <label>
          Last name
          <input
            autoComplete="family-name"
            maxLength={80}
            onChange={(event) => setLastName(event.target.value)}
            required
            value={lastName}
          />
        </label>
        <label>
          Order email
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
          {loading ? "Searching..." : "Track"}
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
        <div className="tracking-order-choices" aria-label="Select order">
          <h2>Multiple orders were found. Select the one you want to view:</h2>
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
            <p className="tracking-cancelled">This order has been cancelled.</p>
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
            This shows the current order status; live delivery location is not
            provided by the system.
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
            <span>Total</span>
            <strong>{money(order.total)}</strong>
          </div>
          {order.status === "Received" && (
            <button
              className="btn cancel-order"
              disabled={loading}
              onClick={cancel}
              type="button">
              Cancel order
            </button>
          )}
        </article>
      )}
    </section>
  );
}
