import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { API_URL } from "../api";

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const { clear } = useStore();
  const clearRef = useRef(clear);
  const captureStarted = useRef(false);
  const [state, setState] = useState({ loading: true, error: "", customer: null });

  useEffect(() => {
    clearRef.current = clear;
  }, [clear]);

  useEffect(() => {
    let active = true;
    if (captureStarted.current) {
      return () => {
        active = false;
      };
    }

    const attemptId = searchParams.get("attempt");
    const paypalOrderId = searchParams.get("token");
    if (!attemptId || !paypalOrderId) {
      setState({
        loading: false,
        error: "The PayPal return data is missing. Please check the payment status.",
        customer: null,
      });
      return () => {
        active = false;
      };
    }

    captureStarted.current = true;
    fetch(`${API_URL}/api/payments/paypal/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId, paypalOrderId }),
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.message || "The payment could not be confirmed.");
        return result;
      })
      .then((customer) => {
        if (!active) return;
        clearRef.current();
        setState({ loading: false, error: "", customer });
      })
      .catch((error) => {
        if (active)
          setState({ loading: false, error: error.message, customer: null });
      });

    return () => {
      active = false;
    };
  }, [searchParams]);

  return (
    <section className="wrap payment-return">
      {state.loading ? (
        <>
          <span className="eyebrow">Maison · PayPal</span>
          <h1>Confirming payment</h1>
          <p>Please keep this page open until the verification is complete.</p>
        </>
      ) : state.customer ? (
        <>
          <span className="eyebrow">Maison · Payment</span>
          <h1>Payment confirmed</h1>
          <p>Your order has been registered successfully. Thank you!</p>
          <Link className="btn" to="/order-tracking" state={state.customer}>
            Track order
          </Link>
          <Link className="btn o" to="/">
            Back to home
          </Link>
        </>
      ) : (
        <>
          <span className="eyebrow">Maison · PayPal</span>
          <h1>Payment not confirmed</h1>
          <p className="payment-error" role="alert">{state.error}</p>
          <p>If PayPal shows that the amount was charged, contact Maison before trying again.</p>
          <Link className="btn" to="/checkout">
            Back to checkout
          </Link>
        </>
      )}
    </section>
  );
}
