import { Link } from "react-router-dom";
import { getCategories, SHIP, eur } from "../data";
import { useStore } from "../context/StoreContext";
import { Grid } from "../components/ProductCard";

export default function Home() {
  const { products, audience } = useStore();
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
              alt={`Koleksioni Maison për ${audience.toLowerCase()}`}
            />
            <div className="hero-overlay">
              <small>Koleksioni Maison · {audience}</small>
              <h1>Stili yt, zgjedhja jote</h1>
              <Link className="btn hero-btn" to="/shop">
                Zbulo koleksionin
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="home-welcome">
          <p className="eyebrow">Mirë se erdhe në Maison</p>
          <h2>Gjej diçka që të përshtatet</h2>
          <p>
            Shfleto koleksionin, ruaj të preferuarat dhe kthehu tek ato kur të
            jesh gati.
          </p>
        </section>
        <h2>Kategoritë</h2>
        <div className="cats">
          {categories.map((c) => (
            <Link key={c} to={"/shop/" + c}>
              {c}
            </Link>
          ))}
        </div>
        <div className="home-featured-heading">
          <div>
            <p className="eyebrow">Për ty · {audience}</p>
            <h2>{bestSellers.length ? "Të preferuarat" : "Zgjedhje për ty"}</h2>
          </div>
          <Link to="/shop">Shiko të gjitha <span aria-hidden="true">↗</span></Link>
        </div>
        {featuredProducts.length ? (
          <Grid items={featuredProducts} />
        ) : (
          <div className="empty">
            Koleksioni po përditësohet.
            <br />
            <Link className="btn" to="/contact">Na kontakto</Link>
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
            <p className="eyebrow">Kemi kënaqësinë të të ndihmojmë</p>
            <h2 id="home-help-title">Shërbime për blerje më të lehtë</h2>
          </div>
          <div className="home-help-grid">
            <Link to="/order-tracking">
              <span className="home-help-icon" aria-hidden="true">01</span>
              <span>
                <strong>Gjurmo porosinë</strong>
                <small>Shiko statusin e porosisë me numrin dhe email-in.</small>
              </span>
              <span className="home-help-arrow" aria-hidden="true">↗</span>
            </Link>
            <Link to="/wishlist">
              <span className="home-help-icon" aria-hidden="true">02</span>
              <span>
                <strong>Ruaj të preferuarat</strong>
                <small>Mbaj afër produktet që të pëlqejnë.</small>
              </span>
              <span className="home-help-arrow" aria-hidden="true">↗</span>
            </Link>
            <Link to="/contact">
              <span className="home-help-icon" aria-hidden="true">03</span>
              <span>
                <strong>Na kontakto</strong>
                <small>Pyetje për produktet apo porosinë? Jemi këtu.</small>
              </span>
              <span className="home-help-arrow" aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
