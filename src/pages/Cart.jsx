import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { cur, eur } from "../data";
import { Photo } from "../components/ProductCard";
import Summary from "../components/Summary";
export default function Cart() {
  const { cart, changeQty, updateVariant, remove, getProduct } = useStore();
  if (!cart.length)
    return (
      <div className="wrap empty">
        <h3>Your cart is empty</h3>
        <p>Add products to continue.</p>
        <Link className="btn" to="/shop">
          View products
        </Link>
      </div>
    );
  return (
    <div className="wrap">
      <div className="two">
        <div>
          <h3>My cart</h3>
          {cart.map((l, i) => {
            const p = getProduct(l.id);
            if (!p) return null;
            return (
              <div className="line" key={`${l.id}-${l.size}-${l.color}`}>
                <Link to={`/product/${p.id}`}>
                  <Photo p={p} />
                </Link>
                <div>
                  <Link to={`/product/${p.id}`}>{p.name}</Link>
                  <div className="line-variants">
                    <label>
                      <span>Size</span>
                      <select
                        aria-label={`Size for ${p.name}`}
                        value={l.size}
                        onChange={(e) =>
                          updateVariant(i, e.target.value, l.color)
                        }>
                        {p.sizes.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Color</span>
                      <select
                        aria-label={`Color for ${p.name}`}
                        value={l.color}
                        onChange={(e) =>
                          updateVariant(i, l.size, e.target.value)
                        }>
                        {p.colors.map((color) => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="qty" style={{ marginTop: 8 }}>
                    <button onClick={() => changeQty(i, -1)}>−</button>
                    <span>{l.qty}</span>
                    <button onClick={() => changeQty(i, 1)}>+</button>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {eur(cur(p) * l.qty)}
                  <br />
                  <button className="rm" onClick={() => remove(i)}>
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <Summary>
          <Link className="btn w" style={{ marginTop: 16 }} to="/checkout">
            Continue to checkout
          </Link>
        </Summary>
      </div>
    </div>
  );
}
