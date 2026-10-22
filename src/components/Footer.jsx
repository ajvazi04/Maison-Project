import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer>
      <div className="wrap fg">
        <div>
          <b>MAISON</b>Veshje dhe aksesorë
          <br />© 2026 Të gjitha të drejtat e rezervuara
        </div>
        <div>
          <b>Transport</b>Kosovë · Shqipëri · Maqedoni
        </div>
        <div>
          <b>Kontakt</b>
          <Link to="/contact">Na kontakto</Link>
          <br />
          info@maison.example
          <br />
          +383 44 000 000
        </div>
        <div>
          <b>Ndihmë</b>
          <Link to="/order-tracking">Gjurmimi i porosisë</Link>
          <br />
          <Link to="/account">Llogaria ime</Link>
          <br />
          <Link to="/wishlist">Të preferuarat</Link>
        </div>
      </div>
    </footer>
  );
}
