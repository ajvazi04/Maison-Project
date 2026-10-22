import { useState } from "react";
import { submitContactMessage } from "../api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setStatus("");
    try {
      await submitContactMessage(form);
      setForm({ name: "", email: "", message: "" });
      setStatus("Mesazhi u dërgua. Faleminderit që na shkrove!");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="wrap contact-page">
      <p className="eyebrow">MAISON · Kontakt</p>
      <h1>Na kontakto</h1>
      <p className="contact-intro">
        Na shkruaj ose telefono për pyetje rreth produkteve dhe porosive.
      </p>
      <div className="contact-details">
        <div>
          <h2>Email</h2>
          <a href="mailto:info@maison.example">info@maison.example</a>
        </div>
        <div>
          <h2>Telefon</h2>
          <a href="tel:+38344000000">+383 44 000 000</a>
        </div>
      </div>
      <form className="contact-form" onSubmit={submit}>
        <h2>Na shkruaj</h2>
        <div className="contact-fields">
          <label>
            Emri
            <input
              autoComplete="name"
              maxLength={80}
              required
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </label>
          <label>
            Emaili
            <input
              autoComplete="email"
              maxLength={254}
              required
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
        </div>
        <label>
          Mesazhi yt
          <textarea
            maxLength={2000}
            minLength={3}
            required
            rows={5}
            value={form.message}
            onChange={(event) =>
              setForm({ ...form, message: event.target.value })
            }
            placeholder="Shkruaj pyetjen ose komentin tënd"
          />
        </label>
        <button className="btn" disabled={sending}>
          {sending ? "Duke dërguar..." : "Dërgo mesazhin"}
        </button>
        {status && (
          <p className="form-status" role="status">
            {status}
          </p>
        )}
      </form>
    </section>
  );
}
