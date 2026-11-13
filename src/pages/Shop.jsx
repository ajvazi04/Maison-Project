import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { cur, eur, getCategories } from "../data";
import { useStore } from "../context/StoreContext";
import { Grid } from "../components/ProductCard";

export default function Shop() {
  const { products, audience } = useStore();
  const { cat } = useParams();
  const [sp] = useSearchParams();
  const q = (sp.get("q") || "").toLowerCase();
  const bestSellersOnly = sp.get("bestSeller") === "1";
  const categories = getCategories(products, audience);
  const [sort, setSort] = useState("new");
  const [max, setMax] = useState(200);
  const list = products
    .filter(
      (p) =>
        (!cat || p.cat === cat) &&
        p.gender === audience &&
        (!bestSellersOnly || p.isBestSeller) &&
        cur(p) <= max &&
        (!q || (p.name + p.cat + p.desc).toLowerCase().includes(q)),
    )
    .sort((a, b) =>
      sort === "lo"
        ? cur(a) - cur(b)
        : sort === "hi"
          ? cur(b) - cur(a)
          : (b.isNew || 0) - (a.isNew || 0),
    );
  return (
    <div className="wrap shop">
      <aside className="side">
        <h4>Category</h4>
        <Link to="/shop">
          <button className={!cat ? "on" : ""}>All</button>
        </Link>
        {categories.map((c) => (
          <Link key={c} to={"/shop/" + c}>
            <button className={cat === c ? "on" : ""}>{c}</button>
          </Link>
        ))}
        <h4 style={{ marginTop: 20 }}>Maximum price: {eur(max)}</h4>
        <input
          type="range"
          min="20"
          max="200"
          step="10"
          value={max}
          onChange={(e) => setMax(+e.target.value)}
          style={{ padding: 0, border: 0 }}
        />
      </aside>
      <section>
        <div className="top">
          <span style={{ color: "var(--mut)" }}>
            {list.length} products{bestSellersOnly ? " · Best sellers" : ""}
            {q && ` for “${q}”`}
          </span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="new">Newest</option>
            <option value="lo">Price: low → high</option>
            <option value="hi">Price: high → low</option>
          </select>
        </div>
        {list.length ? (
          <Grid items={list} />
        ) : (
          <div className="empty">
            No products were found.
            <br />
            Try changing your filters.
          </div>
        )}
      </section>
    </div>
  );
}
