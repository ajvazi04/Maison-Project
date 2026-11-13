import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { SHIP, COUPONS, P, classifyProduct, cur } from "../data";
import { API_URL } from "../api";

const Ctx = createContext();
export const useStore = () => useContext(Ctx);
const load = (k, d) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v == null ? d : v;
  } catch {
    return d;
  }
};

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(() => P.map(classifyProduct));
  const [audience, setAudience] = useState(() => load("maison-audience", ""));
  const [backendError, setBackendError] = useState("");
  const [cart, setCart] = useState(() => load("cart", []));
  const [wish, setWish] = useState(() => load("wish", []));
  const [ship, setShip] = useState(() => load("ship", "XK"));
  const [coupon, setCoupon] = useState(null);
  const [msg, setMsg] = useState("");
  const timer = useRef();

  const refreshProducts = useCallback(async (signal) => {
    try {
      const response = await fetch(`${API_URL}/api/products`, { signal });
      if (!response.ok)
        throw new Error(`The server returned an error (${response.status}).`);
      const result = await response.json();
      if (!Array.isArray(result))
        throw new Error("The server returned an invalid catalog.");
      setProducts(result.map(classifyProduct));
      setBackendError("");
      return true;
    } catch (error) {
      if (error.name === "AbortError") return true;
      console.error("Katalogu nuk u ngarkua nga backend-i:", error);
      setBackendError(
        "The connection to the store was interrupted. Your cart is saved, but the order may not complete.",
      );
      return false;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let retryTimer;
    const attempt = async () => {
      const loaded = await refreshProducts(controller.signal);
      if (!loaded && !controller.signal.aborted)
        retryTimer = setTimeout(attempt, 5000);
    };
    void attempt();
    return () => {
      controller.abort();
      clearTimeout(retryTimer);
    };
  }, [refreshProducts]);

  useEffect(() => {
    try {
      localStorage.setItem("cart", JSON.stringify(cart));
      localStorage.setItem("wish", JSON.stringify(wish));
      localStorage.setItem("ship", JSON.stringify(ship));
      if (audience)
        localStorage.setItem("maison-audience", JSON.stringify(audience));
    } catch {}
  }, [cart, wish, ship, audience]);

  const toast = (m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2200);
  };

  const toggleWish = (id) => {
    const has = wish.includes(id);
    setWish((w) => (has ? w.filter((x) => x !== id) : [...w, id]));
    toast(has ? "Removed from wishlist" : "Added to wishlist");
  };
  const addToCart = (id, size, color, qty) => {
    setCart((c) => {
      const i = c.findIndex(
        (l) => l.id === id && l.size === size && l.color === color,
      );
      if (i < 0) return [...c, { id, size, color, qty }];
      return c.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
    });
    toast("✓ Product added to cart");
  };
  const addVariantsToCart = (id, color, variants) => {
    const selected = Object.entries(variants)
      .filter(([, qty]) => qty > 0)
      .map(([size, qty]) => ({ id, size, color, qty }));
    if (!selected.length) {
      toast("Select a quantity for at least one size");
      return;
    }
    setCart((current) =>
      selected.reduce((items, variant) => {
        const index = items.findIndex(
          (item) =>
            Number(item.id) === Number(variant.id) &&
            item.size === variant.size &&
            item.color === variant.color,
        );
        if (index < 0) return [...items, variant];
        return items.map((item, itemIndex) =>
          itemIndex === index ? { ...item, qty: item.qty + variant.qty } : item,
        );
      }, current),
    );
    toast("✓ Sizes added to cart");
  };
  const changeQty = (i, d) =>
    setCart((c) =>
      c.map((l, j) => (j === i ? { ...l, qty: Math.max(1, l.qty + d) } : l)),
    );
  const updateVariant = (i, size, color) =>
    setCart((c) => {
      const line = c[i];
      if (!line) return c;

      const existingIndex = c.findIndex(
        (item, index) =>
          index !== i &&
          Number(item.id) === Number(line.id) &&
          item.size === size &&
          item.color === color,
      );
      if (existingIndex < 0)
        return c.map((item, index) =>
          index === i ? { ...item, size, color } : item,
        );

      return c
        .map((item, index) =>
          index === existingIndex
            ? { ...item, qty: item.qty + line.qty }
            : item,
        )
        .filter((_, index) => index !== i);
    });
  const remove = (i) => setCart((c) => c.filter((_, j) => j !== i));
  const clear = () => {
    setCart([]);
    setCoupon(null);
  };

  const getProduct = (id) => products.find((p) => Number(p.id) === Number(id));
  const sub = cart.reduce((s, l) => {
    const product = getProduct(l.id);
    return s + (product ? cur(product) : 0) * l.qty;
  }, 0);
  const disc = coupon && sub >= coupon.min ? (sub * coupon.pct) / 100 : 0;
  const shipping = cart.length ? SHIP[ship].p : 0;
  const totals = { sub, disc, shipping, total: sub - disc + shipping };
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const applyCoupon = (code) => {
    const c = COUPONS[code.trim().toUpperCase()];
    if (!c) return toast("Code does not exist");
    if (sub < c.min) return toast("Minimum order: €" + c.min);
    setCoupon({ ...c, code: code.trim().toUpperCase() });
    toast("✓ Coupon applied");
  };

  return (
    <Ctx.Provider
      value={{
        cart,
        products,
        audience,
        setAudience,
        backendError,
        retryProducts: () => refreshProducts(),
        getProduct,
        wish,
        ship,
        setShip,
        couponCode: coupon?.code || "",
        totals,
        count,
        toast,
        toggleWish,
        addToCart,
        addVariantsToCart,
        changeQty,
        updateVariant,
        remove,
        clear,
        applyCoupon,
      }}>
      {children}
      <div id="toast" className={msg ? "s" : ""}>
        {msg}
      </div>
    </Ctx.Provider>
  );
}
