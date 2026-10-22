import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { accountRequest } from "../api";

export default function Account({ account, onAccountChange }) {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(
    ["register", "forgot", "reset"].includes(searchParams.get("mode"))
      ? searchParams.get("mode")
      : "login",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    if (mode === "forgot") {
      try {
        const result = await accountRequest("password-reset/request", {
          email: form.get("email"),
        });
        setNotice(result.message);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (mode === "reset") {
      const password = form.get("password");
      if (password !== form.get("confirmPassword")) {
        setError("Fjalëkalimet nuk përputhen.");
        setLoading(false);
        return;
      }
      const token = searchParams.get("token");
      if (!token) {
        setError("Lidhja e rikthimit nuk është e plotë. Kërko një lidhje të re.");
        setLoading(false);
        return;
      }
      try {
        await accountRequest("password-reset/confirm", { token, password });
        setMode("login");
        setNotice("Fjalëkalimi u ndryshua. Tani mund të kyçesh.");
        navigate("/account?mode=login", { replace: true });
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
      return;
    }
    const values = {
      email: form.get("email"),
      password: form.get("password"),
      ...(mode === "register"
        ? {
            firstName: form.get("firstName"),
            lastName: form.get("lastName"),
          }
        : {}),
    };
    try {
      const result = await accountRequest(
        mode === "register" ? "register" : "login",
        values,
      );
      onAccountChange(result);
      navigate("/account", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setError("");
    setLoading(true);
    try {
      await accountRequest("logout");
      onAccountChange(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setShowPassword(false);
    setError("");
    setNotice("");
    navigate(`/account?mode=${nextMode}`, { replace: true });
  };

  if (account) {
    return (
      <section className="wrap account-page">
        <span className="eyebrow">Maison · Llogaria ime</span>
        <h1>Përshëndetje, {account.firstName}</h1>
        <p className="account-intro">
          Je kyçur me adresën <strong>{account.email}</strong>.
        </p>
        <p className="account-note">
          Mund të blesh edhe pa llogari. Ruaje numrin e porosisë dhe email-in
          për ta gjurmuar porosinë.
        </p>
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        <div className="account-actions">
          <button
            className="btn o"
            disabled={loading}
            onClick={logout}
            type="button">
            {loading ? "Duke dalë..." : "Dil nga llogaria"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="wrap account-page">
      <div className="account-card box">
        <span className="eyebrow">Maison · Llogaria</span>
        <h1>
          {mode === "login"
            ? "Kyçu"
            : mode === "register"
              ? "Krijo llogari"
              : mode === "forgot"
                ? "Ke harruar fjalëkalimin?"
                : "Vendos fjalëkalim të ri"}
        </h1>
        <p className="account-intro">
          {mode === "login" || mode === "register"
            ? mode === "login"
              ? "Hyr në llogarinë tënde, ose vazhdo si mysafir në arkë."
              : "Regjistrimi është opsional. Mund të blesh edhe si mysafir."
            : mode === "forgot"
              ? "Shkruaj email-in e llogarisë dhe do të të dërgojmë një lidhje të sigurt për ndryshimin e fjalëkalimit."
              : "Lidhja është njëpërdorimëshe dhe skadon pas 60 minutave."}
        </p>
        {["login", "register"].includes(mode) ? (
          <div className="account-tabs" aria-label="Hyrja në llogari">
            <button
              aria-pressed={mode === "login"}
              className={mode === "login" ? "on" : ""}
              onClick={() => changeMode("login")}
              type="button">
              Hyr
            </button>
            <button
              aria-pressed={mode === "register"}
              className={mode === "register" ? "on" : ""}
              onClick={() => changeMode("register")}
              type="button">
              Regjistrohu
            </button>
          </div>
        ) : (
          <button
            className="account-back"
            onClick={() => changeMode("login")}
            type="button">
            Kthehu te hyrja
          </button>
        )}
        <form className="account-form" onSubmit={submit}>
          {mode === "register" && (
            <div className="f2">
              <label>
                Emri
                <input
                  autoComplete="given-name"
                  maxLength={80}
                  name="firstName"
                  required
                />
              </label>
              <label>
                Mbiemri
                <input
                  autoComplete="family-name"
                  maxLength={80}
                  name="lastName"
                  required
                />
              </label>
            </div>
          )}
          {mode !== "reset" && (
            <label>
              Email
              <input
                autoComplete="email"
                maxLength={254}
                name="email"
                required
                type="email"
              />
            </label>
          )}
          {["login", "register", "reset"].includes(mode) && (
            <label>
              {mode === "reset" ? "Fjalëkalimi i ri" : "Fjalëkalimi"}
              <span className="password-field">
                <input
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  maxLength={128}
                  minLength={mode === "login" ? undefined : 8}
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"}
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button">
                  {showPassword ? "Fshih" : "Shfaq"}
                </button>
              </span>
              {mode !== "login" && <small>Së paku 8 karaktere.</small>}
            </label>
          )}
          {mode === "reset" && (
            <label>
              Konfirmo fjalëkalimin e ri
              <span className="password-field">
                <input
                  autoComplete="new-password"
                  maxLength={128}
                  minLength={8}
                  name="confirmPassword"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"}
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button">
                  {showPassword ? "Fshih" : "Shfaq"}
                </button>
              </span>
            </label>
          )}
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="account-notice" role="status">
              {notice}
            </p>
          )}
          <button className="btn w" disabled={loading}>
            {loading
              ? "Duke u përpunuar..."
              : mode === "login"
                ? "Hyr"
                : mode === "register"
                  ? "Krijo llogari"
                  : mode === "forgot"
                    ? "Dërgo lidhjen"
                    : "Ndrysho fjalëkalimin"}
          </button>
        </form>
        {mode === "login" && (
          <div className="account-login-links">
            <button
              className="account-forgot"
              onClick={() => changeMode("forgot")}
              type="button">
              Ke harruar fjalëkalimin?
            </button>
            <Link className="account-guest" to="/shop">
              Vazhdo si mysafir <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
