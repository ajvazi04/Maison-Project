import { Link } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { eur } from "../data";

export const Photo = ({ p }) => (
  <div className="im">
    {p.img ? (
      <img src={p.img} alt={p.name} loading="lazy" />
    ) : (
      <span>
        FOTO<small>{p.name}</small>
      </span>
    )}
  </div>
);
export const Price = ({ p }) => (
  <>
    {p.sale && <s>{eur(p.price)}</s>}
    {eur(p.sale || p.price)}
  </>
);

export default function ProductCard({ p }) {
  const { wish, toggleWish } = useStore();
  const on = wish.includes(p.id);
  return (
    <article className="card">
      <Link to={`/product/${p.id}`}>
        <Photo p={p} />
      </Link>
      {p.sale ? (
        <span className="tag">Ofertë</span>
      ) : p.isBestSeller ? (
        <span className="tag">I pëlqyer</span>
      ) : p.isNew ? (
        <span className="tag">E re</span>
      ) : null}
      <button
        className={"heart" + (on ? " on" : "")}
        onClick={() => toggleWish(p.id)}
        aria-label={`${on ? "Hiq nga" : "Shto te"} të preferuarat: ${p.name}`}
        aria-pressed={on}
        type="button">
        {on ? "♥" : "♡"}
      </button>
      <div className="ci">
        <span className="c">{p.cat}</span>
        <Link to={`/product/${p.id}`}>{p.name}</Link>
        <div className="pr">
          <Price p={p} />
        </div>
      </div>
    </article>
  );
}
export const Grid = ({ items }) => (
  <div className="grid">
    {items.map((p) => (
      <ProductCard key={p.id} p={p} />
    ))}
  </div>
);
