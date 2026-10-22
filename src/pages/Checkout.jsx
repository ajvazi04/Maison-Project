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
        console.error("Mënyrat e pagesës nuk u ngarkuan:", optionsError);
      });
    return () => {
      active = false;
    };
  }, []);

  if (done)
    return (
      <div className="wrap empty">
        <h3>Faleminderit për porosinë!</h3>
        <p>
          Porosia u pranua. Përdor emrin, mbiemrin dhe email-in për ta gjurmuar
          ose anuluar.
        </p>
        <Link className="btn" to="/order-tracking" state={done}>
          Gjurmo porosinë
        </Link>
        <Link className="btn" to="/">
          Kthehu në faqen kryesore
        </Link>
      </div>
    );
  if (!cart.length)
    return (
      <div className="wrap empty">
        <h3>Shporta është bosh</h3>
        <Link className="btn" to="/shop">
          Shiko produktet
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
          throw new Error(result.message || "Pagesa me PayPal nuk u përgatit.");

        const approvalUrl = new URL(result.approvalUrl);
        if (
          approvalUrl.protocol !== "https:" ||
          (approvalUrl.hostname !== "paypal.com" &&
            !approvalUrl.hostname.endsWith(".paypal.com"))
        )
          throw new Error("PayPal ktheu një adresë të pavlefshme pagese.");
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
          : result.message || "Porosia nuk u pranua.";
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
          ? "Nuk mundëm ta dërgojmë porosinë sepse lidhja u ndërpre. Shporta jote është ruajtur; provo përsëri pas pak."
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
          <h3>Të dhënat e klientit</h3>
          <div className="f2">
            <input name="firstName" required maxLength="80" placeholder="Emri" />
            <input name="lastName" required maxLength="80" placeholder="Mbiemri" />
          </div>
          <div className="f2">
            <input name="email" required type="email" maxLength="254" placeholder="Email" />
            <label className="phone-field">
              Telefon
              <span className="phone-input">
                <span aria-label={`Kodi telefonik ${PHONE_COUNTRIES[ship].prefix}`}>
                  {PHONE_COUNTRIES[ship].flag} {PHONE_COUNTRIES[ship].prefix}
                </span>
                <input
                  autoComplete="tel-national"
                  aria-describedby="phone-help"
                  aria-label={`Numri i telefonit pa kodin ${phoneConfig.prefix}`}
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
                  placeholder={`${phoneConfig.digits} shifra`}
                  required
                  type="tel"
                  value={phoneNumber}
                />
              </span>
              <small id="phone-help" className="field-hint">
                Numri kombëtar ka {phoneConfig.digits} shifra. Kodi i shtetit shtohet
                automatikisht; zeroja fillestare hiqet nëse e shkruan.
              </small>
            </label>
          </div>
          <h3 style={{ marginTop: 28 }}>Adresa e dërgesës</h3>
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
              aria-label="Qyteti"
              onChange={(event) => setCity(event.target.value)}
              required
              value={city}>
              <option value="">Zgjidh qytetin</option>
              {CITIES[ship].map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="f2">
            <input name="address" required maxLength="200" placeholder="Adresa" />
            <input name="postalCode" maxLength="20" placeholder="Kodi postar" />
          </div>
          <h3 style={{ marginTop: 28 }}>Pagesa</h3>
          <label className="rd payment-option">
            <input
              checked={paymentMethod === "CashOnDelivery"}
              name="pay"
              onChange={() => setPaymentMethod("CashOnDelivery")}
              type="radio"
              value="CashOnDelivery"
            />
            <span>
              <strong>Pagesa në dorëzim</strong>
              <small>Paguaj kur të pranosh porosinë.</small>
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
              <strong>PayPal / kartelë bankare</strong>
              <small>
                {paypalAvailable
                  ? "Paguaj përmes PayPal; pagesa me kartelë ofrohet nëse PayPal e mbështet për llogarinë dhe shtetin tënd."
                  : "Për momentin nuk është në dispozicion. Zgjidh pagesën në dorëzim."}
              </small>
            </span>
          </label>
          {paymentCancelled && (
            <p className="payment-note" role="status">
              Pagesa u anulua në PayPal. Shporta jote është ruajtur.
            </p>
          )}
          {error && <p role="alert" style={{ color: "var(--err, #b42318)" }}>{error}</p>}
        </div>
        <Summary>
          <button className="btn w" style={{ marginTop: 16 }} disabled={submitting}>
            {submitting
              ? "Duke dërguar..."
              : paymentMethod === "PayPal"
                ? "Vazhdo te PayPal"
                : "Përfundo porosinë"}
          </button>
        </Summary>
      </form>
    </div>
  );
}
