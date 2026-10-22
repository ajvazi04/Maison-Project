import { useEffect, useState } from "react";
import { Link, Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Product from "./pages/Product";
import Cart from "./pages/Cart";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import OrderTracking from "./pages/OrderTracking";
import Account from "./pages/Account";
import AdminOrders from "./pages/AdminOrders";
import Contact from "./pages/Contact";
import PaymentReturn from "./pages/PaymentReturn";
import { useStore } from "./context/StoreContext";
import { getCurrentAccount } from "./api";

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("maison-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Theme preference storage can be unavailable in private browsing.
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const { pathname } = useLocation();
  const { audience, setAudience, backendError, retryProducts } = useStore();
  const [account, setAccount] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const toggleTheme = () =>
    setTheme((current) => (current === "dark" ? "light" : "dark"));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    getCurrentAccount()
      .then((currentAccount) => {
        if (active) setAccount(currentAccount);
      })
      .catch(() => {
        if (active) setAccount(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="color-scheme"]')
      ?.setAttribute("content", theme);
    try {
      localStorage.setItem("maison-theme", theme);
    } catch {
      // The theme still applies for the current page when storage is unavailable.
    }
  }, [theme]);

  if (
    !audience &&
    pathname !== "/order-tracking" &&
    pathname !== "/account" &&
    pathname !== "/payment-return"
  ) {
    return (
      <main className="audience-prompt">
        <Link className="logo" to="/">
          MAISON
        </Link>
        <p className="eyebrow">Koleksioni yt</p>
        <h1>Për kë po kërkon?</h1>
        <p>Zgjidh koleksionin për të parë veshje dhe këpucë të përshtatura.</p>
        <div className="audience-choices">
          <button type="button" onClick={() => setAudience("Femra")}>
            Femra
          </button>
          <button type="button" onClick={() => setAudience("Meshkuj")}>
            Meshkuj
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      <Header theme={theme} onToggleTheme={toggleTheme} account={account} />
      {backendError && (
        <div role="status" className="backend-warning">
          {backendError}
          <button type="button" onClick={retryProducts}>
            Provo përsëri
          </button>
        </div>
      )}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/shop/:cat" element={<Shop />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/payment-return" element={<PaymentReturn />} />
          <Route path="/order-tracking" element={<OrderTracking />} />
          <Route
            path="/account"
            element={
              <Account account={account} onAccountChange={setAccount} />
            }
          />
          <Route path="/admin/porosite" element={<AdminOrders />} />
          <Route
            path="*"
            element={<div className="wrap empty">Faqja nuk u gjet.</div>}
          />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
