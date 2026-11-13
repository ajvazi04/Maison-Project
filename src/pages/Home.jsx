import { Link } from "react-router-dom";
import { getCategories, SHIP, eur } from "../data";
import { useStore } from "../context/StoreContext";
import { Grid } from "../components/ProductCard";

export default function Home() {
  const { products, audience } = useStore();
  const audienceLabel = audience === "Femra" ? "Women" : "Men";
  const audienceProducts = products.filter(
    (product) => product.gender === audience,
  );
  const bestSellers = audienceProducts
    .filter((product) => product.isBestSeller)
    .slice(0, 4);
  const featuredProducts = [
    ...bestSellers,
    ...audienceProducts
      .filter((product) => !bestSellers.includes(product))
      .slice(0, 4 - bestSellers.length),
  ];
  const categories = getCategories(products, audience);
  return (
    <>
      <section className="hero">
        <div className="hero-shell">
          <div className={`hero-image hero-image-${audience === "Femra" ? "femra" : "meshkuj"}`}>
            <img
              src="/foto/fotot/foto-cover.jpg"
              alt={`Maison collection for ${audienceLabel.toLowerCase()}`}
            />
            <div className="hero-overlay">
              <small>Maison Collection · {audienceLabel}</small>
              <h1>Your style, your choice</h1>
              <Link className="btn hero-btn" to="/shop">
                Discover the collection
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="home-welcome">
          <p className="eyebrow">Welcome to Maison</p>
          <h2>Find something that suits you</h2>
          <p>
            Browse the collection, save your favourites and come back whenever
            you are ready.
          </p>
        </section>
        <h2>Categories</h2>
        <div className="cats">
          {categories.map((c) => (
            <Link key={c} to={"/shop/" + c}>
              {c}
            </Link>
          ))}
        </div>
        <div className="home-featured-heading">
          <div>
            <p className="eyebrow">For you · {audience}</p>
            <h2>{bestSellers.length ? "Favourites" : "Picked for you"}</h2>
          </div>
          <Link to="/shop">View all <span aria-hidden="true">↗</span></Link>
        </div>
        {featuredProducts.length ? (
          <Grid items={featuredProducts} />
        ) : (
          <div className="empty">
            The collection is being updated.
            <br />
            <Link className="btn" to="/contact">Contact us</Link>
          </div>
        )}
        <div className="ship">
          {Object.values(SHIP).map((s) => (
            <div key={s.n}>
              <b>{s.n}</b>
              <span>
                {eur(s.p)} · {s.d}
              </span>
            </div>
          ))}
        </div>
        <section className="home-help" aria-labelledby="home-help-title">
          <div className="home-help-heading">
            <p className="eyebrow">We are happy to help</p>
            <h2 id="home-help-title">Services for easier shopping</h2>
          </div>
          <div className="home-help-grid">
            <Link to="/order-tracking">
              <span className="home-help-icon" aria-hidden="true">01</span>
              <span>
                <strong>Track order</strong>
                <small>Check order status using your order number and email.</small>
              </span>
              <span className="home-help-arrow" aria-hidden="true">↗</span>
            </Link>
            <Link to="/wishlist">
              <span className="home-help-icon" aria-hidden="true">02</span>
              <span>
                <strong>Save favourites</strong>
                <small>Keep the pieces you love close.</small>
              </span>
              <span className="home-help-arrow" aria-hidden="true">↗</span>
            </Link>
            <Link to="/contact">
              <span className="home-help-icon" aria-hidden="true">03</span>
              <span>
                <strong>Contact us</strong>
                <small>Questions about products or orders? We are here.</small>
              </span>
              <span className="home-help-arrow" aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
