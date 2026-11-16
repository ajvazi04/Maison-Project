import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { Photo, Price, Grid } from "../components/ProductCard";
import { getProductReviews, submitProductReview } from "../api";

const Opts = ({ list, val, set }) => (
  <div className="opt">
    {list.map((o) => (
      <button
        key={o}
        type="button"
        className={val === o ? "on" : ""}
        aria-pressed={val === o}
        onClick={() => set(o)}>
        {o}
      </button>
    ))}
  </div>
);

function Detail({ p, products }) {
  const { addVariantsToCart, toggleWish, wish } = useStore();
  const [color, setColor] = useState(p.colors[0] ?? null);
  const [quantities, setQuantities] = useState({});
  const [reviewData, setReviewData] = useState({
    averageRating: 0,
    reviewCount: 0,
    reviews: [],
  });
  const [reviewName, setReviewName] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [rating, setRating] = useState(0);
  const [reviewStatus, setReviewStatus] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getProductReviews(p.id, controller.signal)
      .then(setReviewData)
      .catch((error) => {
        if (error.name !== "AbortError")
          console.error("Product reviews could not be loaded:", error);
      });
    return () => controller.abort();
  }, [p.id]);

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewSubmitting(true);
    setReviewStatus("");
    try {
      const review = await submitProductReview(p.id, {
        name: reviewName,
        rating,
        comment: reviewComment,
      });
      setReviewData((current) => {
        const reviews = [review, ...current.reviews];
        return {
          reviews,
          reviewCount: reviews.length,
          averageRating:
            Math.round(
              (reviews.reduce((sum, item) => sum + item.rating, 0) /
                reviews.length) *
                10,
            ) / 10,
        };
      });
      setReviewName("");
      setReviewComment("");
      setRating(0);
      setReviewStatus("Thank you for your review!");
    } catch (error) {
      console.error("Product review could not be submitted:", error);
    } finally {
      setReviewSubmitting(false);
    }
  };
  const setSizeQuantity = (size, quantity) => {
    const nextQuantity = Math.max(0, Math.min(20, Number(quantity) || 0));
    setQuantities((current) => ({ ...current, [size]: nextQuantity }));
  };
  const add = () => {
    if (!color) return;
    addVariantsToCart(p.id, color, quantities);
  };
  const rel = products
    .filter((x) => x.cat === p.cat && x.id !== p.id)
    .slice(0, 4);
  return (
    <div className="wrap">
      <div className="crumb">
        <Link to="/">Home</Link> /{" "}
        <Link to={"/shop/" + p.cat}>{p.cat}</Link> / {p.name}
      </div>
      <div className="pd">
        <Photo p={p} />
        <div>
          <span className="eyebrow">{p.cat}</span>
          <h1>{p.name}</h1>
          <div className="pr">
            <Price p={p} />
          </div>
          <p style={{ color: "var(--mut)" }}>{p.desc}</p>
          <div className="lbl">Colour</div>
          <Opts list={p.colors} val={color} set={setColor} />
          <div className="lbl">Sizes and quantities</div>
          <div className="size-quantities">
            {p.sizes.map((itemSize) => (
              <label className="size-quantity" key={itemSize}>
                <span>{itemSize}</span>
                <div className="qty">
                  <button
                    type="button"
                    aria-label={`Decrease quantity for ${itemSize}`}
                    onClick={() =>
                      setSizeQuantity(itemSize, (quantities[itemSize] || 0) - 1)
                    }>
                    −
                  </button>
                  <input
                    aria-label={`Quantity for ${itemSize}`}
                    type="number"
                    min="0"
                    max="20"
                    value={quantities[itemSize] || 0}
                    onChange={(event) =>
                      setSizeQuantity(itemSize, event.target.value)
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Increase quantity for ${itemSize}`}
                    onClick={() =>
                      setSizeQuantity(itemSize, (quantities[itemSize] || 0) + 1)
                    }>
                    +
                  </button>
                </div>
              </label>
            ))}
          </div>
          <div className="product-actions">
            <button
              className="btn"
              style={{ flex: 1 }}
              type="button"
              onClick={add}>
              Add sizes to cart
            </button>
            <button
              className="btn o"
              type="button"
              onClick={() => toggleWish(p.id)}>
              {wish.includes(p.id) ? "♥" : "♡"}
            </button>
          </div>
          <p style={{ color: "var(--mut)", marginTop: 22, fontSize: 12 }}>
            Delivery in Kosovo, Albania and North Macedonia · Cash on delivery
          </p>
        </div>
      </div>
      <section className="reviews" aria-labelledby="reviews-title">
        <div className="reviews-heading">
          <div>
            <span className="eyebrow">Customer experience</span>
            <h2 id="reviews-title">Reviews</h2>
          </div>
          <div className="rating-summary">
            <strong>
              {reviewData.reviewCount
                ? reviewData.averageRating.toFixed(1)
                : "—"}
            </strong>
            <span aria-label={`${reviewData.reviewCount} ratings`}>
              {"★".repeat(Math.round(reviewData.averageRating))}
              {"☆".repeat(5 - Math.round(reviewData.averageRating))}
            </span>
            <small>{reviewData.reviewCount} ratings</small>
          </div>
        </div>
        <div className="review-layout">
          <form className="review-form" onSubmit={submitReview}>
            <h3>Leave your review</h3>
            <label htmlFor="review-name">Name</label>
            <input
              id="review-name"
              maxLength={80}
              required
              value={reviewName}
              onChange={(event) => setReviewName(event.target.value)}
              placeholder="Your name"
            />
            <span className="review-label">Rating</span>
            <div
              className="rating-input"
              role="group"
              aria-label="Rating from 1 to 5 stars">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} stars`}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}>
                  {value <= rating ? "★" : "☆"}
                </button>
              ))}
            </div>
            <label htmlFor="review-comment">Comment</label>
            <textarea
              id="review-comment"
              maxLength={1000}
              minLength={3}
              required
              rows={4}
              value={reviewComment}
              onChange={(event) => setReviewComment(event.target.value)}
              placeholder="How does this product look?"
            />
            <button className="btn" disabled={reviewSubmitting || !rating}>
              {reviewSubmitting ? "Submitting..." : "Send review"}
            </button>
            {reviewStatus && (
              <p className="form-status" role="status">
                {reviewStatus}
              </p>
            )}
          </form>
          <div className="review-list" aria-live="polite">
            {reviewData.reviews.length ? (
              reviewData.reviews.map((review) => (
                <article className="review-item" key={review.id}>
                  <div className="review-item-top">
                    <strong>{review.name}</strong>
                    <time dateTime={review.createdAtUtc}>
                      {new Intl.DateTimeFormat("sq-XK", {
                        dateStyle: "medium",
                      }).format(new Date(review.createdAtUtc))}
                    </time>
                  </div>
                  <span
                    className="review-stars"
                    aria-label={`${review.rating} out of 5 stars`}>
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                  <p>{review.comment}</p>
                </article>
              ))
            ) : (
              <p className="review-empty">
                No reviews have been left for this product yet.
              </p>
            )}
          </div>
        </div>
      </section>
      {rel.length > 0 && (
        <>
          <h2>Related products</h2>
          <Grid items={rel} />
        </>
      )}
    </div>
  );
}
export default function Product() {
  const { id } = useParams();
  const { products } = useStore();
  const p = products.find((product) => Number(product.id) === Number(id));
  return p ? (
    <Detail key={id} p={p} products={products} />
  ) : (
    <div className="wrap empty">Product not found.</div>
  );
}
