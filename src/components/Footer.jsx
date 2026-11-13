import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer>
      <div className="wrap fg">
        <div>
          <b>MAISON</b>Clothing and accessories
          <br />© 2026 All rights reserved
        </div>
        <div>
          <b>Shipping</b>Kosovo · Albania · North Macedonia
        </div>
        <div>
          <b>Contact</b>
          <Link to="/contact">Contact us</Link>
          <br />
          info@maison.example
          <br />
          +383 44 000 000
        </div>
        <div>
          <b>Help</b>
          <Link to="/order-tracking">Order tracking</Link>
          <br />
          <Link to="/account">My account</Link>
          <br />
          <Link to="/wishlist">Wishlist</Link>
        </div>
      </div>
    </footer>
  );
}
