import { useState } from "react";
import { useStore } from "../context/StoreContext";
import { SHIP, eur } from "../data";

export default function Summary({ children }) {
  const { ship, setShip, totals: t, applyCoupon } = useStore();
  const [code, setCode] = useState("");
  return (
    <div className="box">
      <h3>Summary</h3>
      <label className="lbl" style={{ marginTop: 0 }}>
        Shipping to
      </label>
      <select value={ship} onChange={(e) => setShip(e.target.value)}>
        {Object.entries(SHIP).map(([k, v]) => (
          <option key={k} value={k}>
            {v.n} — {eur(v.p)} ({v.d})
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        <input
          placeholder="Coupon code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          type="button"
          className="btn o"
          style={{ padding: "0 16px" }}
          onClick={() => applyCoupon(code)}>
          Apply
        </button>
      </div>
      <div className="row">
        <span>Subtotal</span>
        <span>{eur(t.sub)}</span>
      </div>
      <div className="row">
        <span>Shipping</span>
        <span>{eur(t.shipping)}</span>
      </div>
      {t.disc > 0 && (
        <div className="row">
          <span>Discount</span>
          <span>-{eur(t.disc)}</span>
        </div>
      )}
      <div className="row t">
        <span>Total</span>
        <span>{eur(t.total)}</span>
      </div>
      {children}
    </div>
  );
}
