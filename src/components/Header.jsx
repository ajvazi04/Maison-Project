import { useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { cur, getCategories } from "../data";

export default function Header({ theme, onToggleTheme, account }) {
  const { count, wish, products, audience, setAudience } = useStore();
  const categories = getCategories(products, audience);
  const go = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchRef = useRef(null);
  const suggestions = useMemo(() => {
    const query = searchText
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (!query) return [];
    return products.filter((product) => {
      const name = product.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      return name.startsWith(query) || (query.length > 1 && name.includes(query));
    });
  }, [products, searchText]);

  const openSearch = (query) => {
    const value = query.trim();
    if (!value) return;
    setIsSearchOpen(false);
    setActiveSuggestion(-1);
    go("/shop?q=" + encodeURIComponent(value));
    setSearchText("");
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      setActiveSuggestion(-1);
      return;
    }
    if (!suggestions.length) {
      if (event.key === "Enter") {
        event.preventDefault();
        openSearch(searchText);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsSearchOpen(true);
      setActiveSuggestion((current) =>
        event.key === "ArrowDown"
          ? (current + 1) % suggestions.length
          : (current <= 0 ? suggestions.length : current) - 1,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const suggestion = suggestions[activeSuggestion];
      if (suggestion) {
        setSearchText("");
        setIsSearchOpen(false);
        go(`/product/${suggestion.id}`);
      } else {
        openSearch(searchText);
      }
    }
  };
  return (
    <header>
      <div className="wrap bar">
        <Link className="logo header-logo" to="/">
          MAISON
        </Link>
        <div className="audience-switch" aria-label="Choose collection">
          {[
            { label: "Women", value: "Femra" },
            { label: "Men", value: "Meshkuj" },
          ].map(({ label, value }) => (
            <button
              key={value}
              type="button"
              className={audience === value ? "on" : ""}
              aria-pressed={audience === value}
              onClick={() => setAudience(value)}>
              {label}
            </button>
          ))}
        </div>
        <div className="header-search-wrap">
          <input
            ref={searchRef}
            aria-activedescendant={
              activeSuggestion >= 0
                ? `product-suggestion-${suggestions[activeSuggestion]?.id}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls="product-suggestions"
            aria-expanded={isSearchOpen && suggestions.length > 0}
            aria-label="Search products"
            autoComplete="off"
            className="sr header-search"
            onChange={(event) => {
              setSearchText(event.target.value);
              setIsSearchOpen(true);
              setActiveSuggestion(-1);
            }}
            onBlur={() => setIsSearchOpen(false)}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder=            "Search products…"            role="combobox"
            value={searchText}
          />
          {isSearchOpen && suggestions.length > 0 && (
            <ul
              className="search-suggestions"
              id="product-suggestions"
              role="listbox">
              {suggestions.map((product, index) => (
                <li key={product.id} role="presentation">
                  <button
                    aria-selected={index === activeSuggestion}
                    className="search-suggestion"
                    id={`product-suggestion-${product.id}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSearchText("");
                      setIsSearchOpen(false);
                      setActiveSuggestion(-1);
                      searchRef.current?.blur();
                      go(`/product/${product.id}`);
                    }}
                    onMouseEnter={() => setActiveSuggestion(index)}
                    role="option"
                    type="button">
                    <span>{product.name}</span>
                    <small>€{cur(product).toFixed(2)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link className="ic wishlist-action" to="/wishlist">
          ♡<b>{wish.length}</b>
        </Link>
        <Link className="ic cart-action" to="/cart">
          Cart<b>{count}</b>
        </Link>
        <Link className="ic account-nav" to="/account">
          {account ? account.firstName : "Sign in / Register"}
        </Link>
        <button
          className="theme-toggle"
          type="button"
          onClick={onToggleTheme}
          role="switch"
          aria-checked={theme === "dark"}
          aria-label={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          title={
            theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }>
          <span className="switch-icon switch-sun" aria-hidden="true">
            ☀
          </span>
          <span className="switch-icon switch-moon" aria-hidden="true">
            ☾
          </span>
          <span className="switch-thumb" aria-hidden="true" />
        </button>
        <nav className="category-nav" aria-label="Main categories">
          <NavLink to="/shop" end>
            All
          </NavLink>
          {categories.map((category) => (
            <NavLink key={category} to={`/shop/${category}`}>
              {category}
            </NavLink>
          ))}
          <NavLink to="/shop?bestSeller=1">Best sellers</NavLink>
          <NavLink to="/order-tracking">Track order</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </nav>
      </div>
    </header>
  );
}
