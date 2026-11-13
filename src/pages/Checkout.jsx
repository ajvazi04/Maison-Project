import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { CITIES, PHONE_COUNTRIES, SHIP } from "../data";
import Summary from "../components/Summary";
import { API_URL } from "../api";

export default function Checkout() {
  const { cart, ship, setShip, clear, couponCode } = useStore();
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [city, setCity] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CashOnDelivery");
  const [paypalAvailable, setPaypalAvailable] = useState(false);
  const [paymentCancelled, setPaymentCancelled] = useState(
    new URLSearchParams(window.location.search).get("payment") === "cancelled",
  );
  const phoneConfig = PHONE_COUNTRIES[ship];

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/payments/options`)
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Gabim nga serveri (${response.status}).`);
        return response.json();
      })
      .then((options) => {
        if (active) setPaypalAvailable(options.paypal === true);
      })
      .catch((optionsError) => {
        console.error("Payment methods could not be loaded:", optionsError);
      });
    return () => {
      active = false;
    };
  }, []);

  if (done)
    return (
      <div className="wrap empty">
        <h3>Thank you for your order!</h3>
        <p>
          Your order has been received. Use your first name, last name and email
          to track or cancel it.
        </p>
        <Link className="btn" to="/order-tracking" state={done}>
          Track order
        </Link>
        <Link className="btn" to="/">
          Back to home
        </Link>
      </div>
    );
  if (!cart.length)
    return (
      <div className="wrap empty">
        <h3>Your cart is empty</h3>
        <Link className="btn" to="/shop">
          View products
        </Link>
      </div>
    );
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const form = new FormData(e.currentTarget);
    const order = {
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: `${PHONE_COUNTRIES[ship].prefix}${phoneNumber}`,
      country: ship,
      city,
      address: form.get("address"),
      postalCode: form.get("postalCode"),
      couponCode,
      items: cart.map(({ id, size, color, qty }) => ({
        productId: id,
        size,
        color,
        quantity: qty,
      })),
    };
    try {
      if (paymentMethod === "PayPal") {
        const response = await fetch(`${API_URL}/api/payments/paypal/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message || "PayPal payment was not prepared.");

        const approvalUrl = new URL(result.approvalUrl);
        if (
          approvalUrl.protocol !== "https:" ||
          (approvalUrl.hostname !== "paypal.com" &&
            !approvalUrl.hostname.endsWith(".paypal.com"))
        )
          throw new Error("PayPal returned an invalid payment URL.");
        window.location.assign(approvalUrl.href);
        return;
      }

      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result.errors
          ? Object.values(result.errors).flat().join(" ")
          : result.message || "The order was not accepted.";
        throw new Error(message);
      }
      setDone({
        firstName: order.firstName,
        lastName: order.lastName,
        email: order.email,
      });
      clear();
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "We could not send the order because the connection was interrupted. Your cart is saved; please try again shortly."
          : err.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wrap">
      <form className="two" onSubmit={submit}>
        <div>
          <h3>Customer details</h3>
          <div className="f2">
            <input name="firstName" required maxLength="80" placeholder="First name" />
            <input name="lastName" required maxLength="80" placeholder="Last name" />
          </div>
          <div className="f2">
            <input name="email" required type="email" maxLength="254" placeholder="Email" />
            <label className="phone-field">
              Phone
              <span className="phone-input">
                <span aria-label={`Phone code ${PHONE_COUNTRIES[ship].prefix}`}>
                  {PHONE_COUNTRIES[ship].flag} {PHONE_COUNTRIES[ship].prefix}
                </span>
                <input
                  autoComplete="tel-national"
                  aria-describedby="phone-help"
                  aria-label={`Phone number without the ${phoneConfig.prefix} code`}
                  inputMode="tel"
                  maxLength={24}
                  minLength={phoneConfig.digits}
                  onChange={(event) => {
                    let digits = event.target.value.replace(/\D/g, "");
                    const countryCode = phoneConfig.prefix.slice(1);
                    if (digits.startsWith(countryCode))
                      digits = digits.slice(countryCode.length);
                    if (digits.length > phoneConfig.digits && digits.startsWith("0"))
                      digits = digits.slice(1);
                    setPhoneNumber(digits.slice(0, phoneConfig.digits));
                  }}
                  pattern={`[0-9]{${phoneConfig.digits}}`}
                  placeholder={`${phoneConfig.digits} digits`}
                  required
                  type="tel"
                  value={phoneNumber}
                />
              </span>
              <small id="phone-help" className="field-hint">
                Domestic numbers have {phoneConfig.digits} digits. The country code is
                added automatically; the leading zero is removed if entered.
              </small>
            </label>
          </div>
          <h3 style={{ marginTop: 28 }}>Shipping address</h3>
          <div className="f2">
            <select
              value={ship}
              onChange={(event) => {
                const nextCountry = event.target.value;
                setShip(nextCountry);
                setPhoneNumber((current) =>
                  current.slice(0, PHONE_COUNTRIES[nextCountry].digits),
                );
                setCity("");
              }}>
              {Object.entries(SHIP).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.n}
                </option>
              ))}
            </select>
            <select
              aria-label="City"
              onChange={(event) => setCity(event.target.value)}
              required
              value={city}>
              <option value="">Select city</option>
              {CITIES[ship].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="f2">
            <input name="address" required maxLength="200" placeholder="Address" />
            <input name="postalCode" maxLength="20" placeholder="Postal code" />
          </div>
          <h3 style={{ marginTop: 28 }}>Payment</h3>
          <label className="rd payment-option">
            <input
              checked={paymentMethod === "CashOnDelivery"}
              name="pay"
              onChange={() => setPaymentMethod("CashOnDelivery")}
              type="radio"
              value="CashOnDelivery"
            />
            <span>
              <strong>Cash on delivery</strong>
              <small>Pay when your order arrives.</small>
            </span>
          </label>
          <label className={`rd payment-option ${paypalAvailable ? "" : "unavailable"}`}>
            <input
              checked={paymentMethod === "PayPal"}
              disabled={!paypalAvailable}
              name="pay"
              onChange={() => setPaymentMethod("PayPal")}
              type="radio"
              value="PayPal"
            />
            <span>
              <strong>PayPal / bank card</strong>
              <small>
                {paypalAvailable
                  ? "Pay via PayPal; card payments are available when PayPal supports your account and country."
                  : "Currently unavailable. Please choose cash on delivery."}
              </small>
            </span>
          </label>
          {paymentCancelled && (
            <p className="payment-note" role="status">
              The payment was cancelled in PayPal. Your cart is still saved.
            </p>
          )}
          {error && <p role="alert" style={{ color: "var(--err, #b42318)" }}>{error}</p>}
        </div>
        <Summary>
          <button className="btn w" style={{ marginTop: 16 }} disabled={submitting}>
            {submitting
              ? "Submitting..."
              : paymentMethod === "PayPal"
                ? "Continue to PayPal"
                : "Complete order"}
          </button>
        </Summary>
      </form>
    </div>
  );
}
