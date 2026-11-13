import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { Grid } from "../components/ProductCard";

export default function Wishlist() {
  const { wish, getProduct } = useStore();
  const items = wish.map(getProduct).filter(Boolean);
  return (
    <div className="wrap" style={{ paddingTop: 36 }}>
      <h3>Your wishlist</h3>
      {items.length ? (
        <Grid items={items} />
      ) : (
        <div className="empty">
          You have no saved products.
          <br />
          <Link className="btn" to="/shop">
            View products
          </Link>
        </div>
      )}
    </div>
  );
}
