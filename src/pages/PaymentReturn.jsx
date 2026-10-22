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
        error: "Të dhënat e kthimit nga PayPal mungojnë. Kontrollo statusin e pagesës.",
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
          throw new Error(result.message || "Pagesa nuk mund të konfirmohej.");
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
          <h1>Po konfirmojmë pagesën</h1>
          <p>Mbaje këtë faqe hapur derisa të përfundojë verifikimi.</p>
        </>
      ) : state.customer ? (
        <>
          <span className="eyebrow">Maison · Pagesa</span>
          <h1>Pagesa u konfirmua</h1>
          <p>Porosia u regjistrua me sukses. Faleminderit!</p>
          <Link className="btn" to="/order-tracking" state={state.customer}>
            Gjurmo porosinë
          </Link>
          <Link className="btn o" to="/">
            Kthehu në faqen kryesore
          </Link>
        </>
      ) : (
        <>
          <span className="eyebrow">Maison · PayPal</span>
          <h1>Pagesa nuk u konfirmua</h1>
          <p className="payment-error" role="alert">{state.error}</p>
          <p>Nëse PayPal tregon se shuma është marrë, kontakto Maison para se të provosh sërish.</p>
          <Link className="btn" to="/checkout">
            Kthehu te arka
          </Link>
        </>
      )}
    </section>
  );
}
