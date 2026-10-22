import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../api";

const PAGE_SIZE = 100;
const STATUS_LABELS = {
  Received: "Pranuar",
  Confirmed: "Konfirmuar",
  SentToCourier: "Dërguar te kurieri",
  Delivered: "Dorëzuar",
  Cancelled: "Anuluar",
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
        setError("Sesioni ka skaduar. Hyr përsëri si administrator.");
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
        setError("Sesioni ka skaduar. Hyr përsëri si administrator.");
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
        "A dëshiron ta fshehësh këtë porosi nga lista aktive? Porosia do të ruhet në databazë.",
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
          <span className="eyebrow">Maison · Administrim</span>
          <h1>Porositë e kësaj jave</h1>
          <p>Hyr me kredencialet e administratorit për të parë porositë.</p>
          <form onSubmit={login}>
            <label>
              Emri i përdoruesit
              <input
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label>
              Fjalëkalimi
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
              {loading ? "Duke u kyçur..." : "Hyr"}
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
          <span className="eyebrow">Maison · Administrim</span>
          <h1>
            {view === "orders"
              ? "Porositë e kësaj jave"
              : "Mesazhet e klientëve"}
          </h1>
          <p>
            {view === "orders"
              ? "Java llogaritet nga e hëna, sipas orës lokale të shfletuesit."
              : "Mesazhet më të fundit të dërguara nga faqja Na kontakto."}
          </p>
        </div>
        <div className="admin-actions">
          <button
            className="btn o"
            onClick={view === "orders" ? loadOrders : loadContactMessages}
            disabled={loading}>
            {loading ? "Duke rifreskuar..." : "Rifresko"}
          </button>
          <button className="btn o" onClick={logout}>
            Dil
          </button>
        </div>
      </div>

      <div
        className="admin-tabs"
        role="tablist"
        aria-label="Pamja e administrimit">
        <button
          type="button"
          role="tab"
          aria-selected={view === "orders"}
          className={view === "orders" ? "on" : ""}
          onClick={() => setView("orders")}>
          Porositë
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "messages"}
          className={view === "messages" ? "on" : ""}
          onClick={() => setView("messages")}>
          Mesazhet ({contactMessages.length})
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
              <span>Porosi këtë javë</span>
              <strong>{totalCount}</strong>
            </div>
            <div className="box">
              <span>Qarkullimi këtë javë</span>
              <strong>{money(weeklyTotal)}</strong>
            </div>
          </div>

          {loading && !orders.length ? (
            <p className="admin-empty">Duke ngarkuar porositë...</p>
          ) : !orders.length ? (
            <div className="box admin-empty">Nuk ka ende porosi këtë javë.</div>
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
                      <h2>Klienti</h2>
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
                      <h2>Produktet</h2>
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
                        Pagesa:{" "}
                        {order.paymentMethod === "PayPal"
                          ? "PayPal"
                          : "Në dorëzim"}
                      </span>
                      <span>Nëntotali: {money(order.subtotal)}</span>
                      {order.discount > 0 && (
                        <span>Zbritja: −{money(order.discount)}</span>
                      )}
                      <span>Transporti: {money(order.shipping)}</span>
                      <strong>Totali: {money(order.total)}</strong>
                      <label>
                        Statusi
                        <select
                          aria-label={`Statusi i porosisë ${order.orderNumber}`}
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
                          Fshi nga lista aktive
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
                Më të rejat
              </button>
              <span>
                Faqja {page} / {pageCount}
              </span>
              <button
                className="btn o"
                disabled={page >= pageCount}
                onClick={() => setPage(page + 1)}>
                Më të vjetrat
              </button>
            </div>
          )}
        </>
      ) : loading && !contactMessages.length ? (
        <p className="admin-empty">Duke ngarkuar mesazhet...</p>
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
                  "Përgjigje për mesazhin tuaj - Maison",
                )}&body=${encodeURIComponent(
                  `Përshëndetje ${message.name},\n\nFaleminderit që kontaktuat Maison.\n\n`,
                )}`}>
                Përgjigju me email
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="box admin-empty">Nuk ka ende mesazhe.</div>
      )}
    </section>
  );
}
