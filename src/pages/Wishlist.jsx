import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { Grid } from "../components/ProductCard";

export default function Wishlist() {
  const { wish, getProduct } = useStore();
  const items = wish.map(getProduct).filter(Boolean);
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <h3>Të preferuarat</h3>
      {items.length ? (
        <Grid items={items} />
      ) : (
        <div className="empty">
          Nuk keni asnjë produkt të ruajtur.
          <br />
          <Link className="btn" to="/shop">
            Shiko produktet
          </Link>
        </div>
      )}
    </div>
  );
}
