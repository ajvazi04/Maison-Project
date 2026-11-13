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
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      const token = searchParams.get("token");
      if (!token) {
        setError("The reset link is incomplete. Please request a new link.");
        setLoading(false);
        return;
      }
      try {
        await accountRequest("password-reset/confirm", { token, password });
        setMode("login");
        setNotice("Password updated. You can now sign in.");
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
        <span className="eyebrow">Maison · My account</span>
        <h1>Hello, {account.firstName}</h1>
        <p className="account-intro">
          You are signed in with <strong>{account.email}</strong>.
        </p>
        <p className="account-note">
          You can shop without an account. Save your order number and email to
          track your order.
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
            {loading ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="wrap account-page">
      <div className="account-card box">
        <span className="eyebrow">Maison · Account</span>
        <h1>
          {mode === "login"
            ? "Sign in"
            : mode === "register"
              ? "Create account"
              : mode === "forgot"
                ? "Forgot your password?"
                : "Set a new password"}
        </h1>
        <p className="account-intro">
          {mode === "login" || mode === "register"
            ? mode === "login"
              ? "Sign in to your account or continue as a guest at checkout."
              : "Registration is optional. You can still shop as a guest."
            : mode === "forgot"
              ? "Enter your account email and we’ll send a secure link to change your password."
              : "The link is single-use and expires after 60 minutes."}
        </p>
        {["login", "register"].includes(mode) ? (
          <div className="account-tabs" aria-label="Account access">
            <button
              aria-pressed={mode === "login"}
              className={mode === "login" ? "on" : ""}
              onClick={() => changeMode("login")}
              type="button">
              Sign in
            </button>
            <button
              aria-pressed={mode === "register"}
              className={mode === "register" ? "on" : ""}
              onClick={() => changeMode("register")}
              type="button">
              Register
            </button>
          </div>
        ) : (
          <button
            className="account-back"
            onClick={() => changeMode("login")}
            type="button">
            Back to sign in
          </button>
        )}
        <form className="account-form" onSubmit={submit}>
          {mode === "register" && (
            <div className="f2">
              <label>
                First name
                <input
                  autoComplete="given-name"
                  maxLength={80}
                  name="firstName"
                  required
                />
              </label>
              <label>
                Last name
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
              {mode === "reset" ? "New password" : "Password"}
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              {mode !== "login" && <small>At least 8 characters.</small>}
            </label>
          )}
          {mode === "reset" && (
            <label>
              Confirm new password
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
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button">
                  {showPassword ? "Hide" : "Show"}
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
              ? "Processing..."
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send link"
                    : "Update password"}
          </button>
        </form>
        {mode === "login" && (
          <div className="account-login-links">
            <button
              className="account-forgot"
              onClick={() => changeMode("forgot")}
              type="button">
              Forgot your password?
            </button>
            <Link className="account-guest" to="/shop">
              Continue as guest <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
