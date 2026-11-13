import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../api";

const PAGE_SIZE = 100;
const STATUS_LABELS = {
  Received: "Received",
  Confirmed: "Confirmed",
  SentToCourier: "Sent to courier",
  Delivered: "Delivered",
  Cancelled: "Cancelled",
};
const NEXT_STATUSES = {
  Received: ["Confirmed", "Cancelled"],
  Confirmed: ["SentToCourier", "Cancelled"],
  SentToCourier: ["Delivered"],
  Delivered: [],
  Cancelled: ["Received"],
};

function getWeekRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return { fromUtc: start.toISOString(), toUtc: now.toISOString() };
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;

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
    const message = result.errors
      ? Object.values(result.errors).flat().join(" ")
      : result.message ||
        result.title ||
        `Gabim nga serveri (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return result;
}

const money = (amount) =>
  new Intl.NumberFormat("sq-XK", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

const dateTime = (value) =>
  new Intl.DateTimeFormat("sq-XK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export default function AdminOrders() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [view, setView] = useState("orders");
  const [totalCount, setTotalCount] = useState(0);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyOrder, setBusyOrder] = useState("");
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const range = getWeekRange();
      const params = new URLSearchParams({
        ...range,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      const result = await request(`/api/admin/orders/week?${params}`);
      setOrders(result.orders);
      setTotalCount(result.totalCount);
      setWeeklyTotal(result.weeklyTotal);
    } catch (err) {
      if (err.status === 401) {
        setIsAuthenticated(false);
        setError("Your session has expired. Please sign in again as an administrator.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  const loadContactMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setContactMessages(await request("/api/admin/contact-messages"));
    } catch (err) {
      if (err.status === 401) {
        setIsAuthenticated(false);
        setError("Your session has expired. Please sign in again as an administrator.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (view === "messages") loadContactMessages();
    else loadOrders();
  }, [isAuthenticated, view, loadOrders, loadContactMessages]);

  const login = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await request("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setPassword("");
      setPage(1);
      setIsAuthenticated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError("");
    try {
      await request("/api/admin/logout", { method: "POST" });
      setIsAuthenticated(false);
      setOrders([]);
      setContactMessages([]);
      setTotalCount(0);
      setWeeklyTotal(0);
    } catch (err) {
      setError(err.message);
    }
  };

  const updateStatus = async (order, status) => {
    setBusyOrder(order.orderNumber);
    setError("");
    try {
      const id = Number(order.orderNumber.replace("MAS-", ""));
      await request(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyOrder("");
    }
  };

  const archiveOrder = async (order) => {
    if (
      !window.confirm(
        "Do you want to hide this order from the active list? It will be kept in the database.",
      )
    )
      return;

    setBusyOrder(order.orderNumber);
    setError("");
    try {
      const id = Number(order.orderNumber.replace("MAS-", ""));
      await request(`/api/admin/orders/${id}/archive`, { method: "POST" });
      await loadOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyOrder("");
    }
  };

  if (!isAuthenticated) {
    return (
      <section className="admin-page wrap">
        <div className="admin-login box">
          <span className="eyebrow">Maison · Administration</span>
          <h1>This week’s orders</h1>
          <p>Sign in with the administrator credentials to view orders.</p>
          <form onSubmit={login}>
            <label>
              Username
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                autoComplete="current-password"
                required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && (
              <p className="admin-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn w" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  return (
    <section className="admin-page wrap">
      <div className="admin-heading">
        <div>
          <span className="eyebrow">Maison · Administration</span>
          <h1>
            {view === "orders"
              ? "This week’s orders"
              : "Customer messages"}
          </h1>
          <p>
            {view === "orders"
              ? "The week is counted from Monday according to the browser’s local time."
              : "The latest messages sent from the Contact page."}
          </p>
        </div>
        <div className="admin-actions">
          <button
            className="btn o"
            onClick={view === "orders" ? loadOrders : loadContactMessages}
            disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="btn o" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>

      <div
        className="admin-tabs"
        role="tablist"
        aria-label="Administration view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "orders"}
          className={view === "orders" ? "on" : ""}
          onClick={() => setView("orders")}>
          Orders
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "messages"}
          className={view === "messages" ? "on" : ""}
          onClick={() => setView("messages")}>
          Messages ({contactMessages.length})
        </button>
      </div>

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}

      {view === "orders" ? (
        <>
          <div className="admin-stats">
            <div className="box">
              <span>Orders this week</span>
              <strong>{totalCount}</strong>
            </div>
            <div className="box">
              <span>Turnover this week</span>
              <strong>{money(weeklyTotal)}</strong>
            </div>
          </div>

          {loading && !orders.length ? (
            <p className="admin-empty">Loading orders...</p>
          ) : !orders.length ? (
            <div className="box admin-empty">There are no orders this week yet.</div>
          ) : (
            <div className="admin-orders">
              {orders.map((order) => (
                <article className="box admin-order" key={order.orderNumber}>
                  <div className="admin-order-top">
                    <div>
                      <strong>{order.orderNumber}</strong>
                      <time dateTime={order.createdAtUtc}>
                        {dateTime(order.createdAtUtc)}
                      </time>
                    </div>
                    <span
                      className={`admin-status status-${order.status.toLowerCase()}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>

                  <div className="admin-order-grid">
                    <div>
                      <h2>Customer</h2>
                      <p>
                        {order.firstName} {order.lastName}
                      </p>
                      <p>
                        <a href={`mailto:${order.email}`}>{order.email}</a>
                      </p>
                      <p>
                        <a href={`tel:${order.phone}`}>{order.phone}</a>
                      </p>
                      <p>
                        {order.address}, {order.city}, {order.country}
                        {order.postalCode ? ` · ${order.postalCode}` : ""}
                      </p>
                    </div>
                    <div>
                      <h2>Products</h2>
                      <ul className="admin-items">
                        {order.items.map((item, index) => (
                          <li
                            key={`${item.productId}-${item.size}-${item.color}-${index}`}>
                            <span>
                              {item.productName} · {item.size} · {item.color} ×{" "}
                              {item.quantity}
                            </span>
                            <strong>{money(item.lineTotal)}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="admin-total">
                      <span>
                        Payment:{" "}
                        {order.paymentMethod === "PayPal"
                          ? "PayPal"
                          : "Cash on delivery"}
                      </span>
                      <span>Subtotal: {money(order.subtotal)}</span>
                      {order.discount > 0 && (
                        <span>Discount: −{money(order.discount)}</span>
                      )}
                      <span>Shipping: {money(order.shipping)}</span>
                      <strong>Total: {money(order.total)}</strong>
                      <label>
                        Status
                        <select
                          aria-label={`Order status ${order.orderNumber}`}
                          disabled={busyOrder === order.orderNumber}
                          value={order.status}
                          onChange={(event) =>
                            updateStatus(order, event.target.value)
                          }>
                          <option value={order.status}>
                            {STATUS_LABELS[order.status] || order.status}
                          </option>
                          {(NEXT_STATUSES[order.status] || []).map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {order.status === "SentToCourier" && (
                        <button
                          className="btn o archive-order"
                          disabled={busyOrder === order.orderNumber}
                          onClick={() => archiveOrder(order)}
                          type="button">
                          Remove from active list
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div className="admin-pagination">
              <button
                className="btn o"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}>
                Newest
              </button>
              <span>
                Page {page} / {pageCount}
              </span>
              <button
                className="btn o"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}>
                Older
              </button>
            </div>
          )}
        </>
      ) : loading && !contactMessages.length ? (
        <p className="admin-empty">Loading messages...</p>
      ) : contactMessages.length ? (
        <div className="admin-messages">
          {contactMessages.map((message) => (
            <article className="box admin-message" key={message.id}>
              <div className="admin-order-top">
                <strong>{message.name}</strong>
                <time dateTime={message.createdAtUtc}>
                  {dateTime(message.createdAtUtc)}
                </time>
              </div>
              <a href={`mailto:${message.email}`}>{message.email}</a>
              <p>{message.message}</p>
              <a
                className="btn o reply-message"
                href={`mailto:${message.email}?subject=${encodeURIComponent(
                  "Reply to your message - Maison",
                )}&body=${encodeURIComponent(
                  `Hello ${message.name},\n\nThank you for contacting Maison.\n\n`,
                )}`}>
                Reply by email
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="box admin-empty">There are no messages yet.</div>
      )}
    </section>
  );
}
