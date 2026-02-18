import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth, useCart } from "../context";

export function CheckoutPage() {
  const { token } = useAuth();
  const { items, total, refreshCart } = useCart();
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const buy = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      return;
    }

    setMessage(null);
    setError(null);

    try {
      await apiRequest("/cart/checkout", {
        method: "POST",
        token,
        body: { cardNumber, cardHolder, expiry, cvv }
      });

      await refreshCart();
      setMessage("Покупка завершена. Треки добавлены в медиатеку.");
      setTimeout(() => navigate("/library"), 800);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось завершить покупку");
    }
  };

  return (
    <section className="panel checkout">
      <h1>Оплата</h1>
      {message && <p className="state">{message}</p>}
      {error && <p className="state state--error">{error}</p>}

      <div className="checkout-grid">
        <div className="panel">
          <h2>Ваши треки</h2>
          {items.length === 0 && <p className="muted">Корзина пуста</p>}
          {items.map((item) => (
            <p key={item.trackId}>
              {item.title} · {item.authorName} · {item.price.toFixed(2)} {"\u20BD"}
            </p>
          ))}
          <p>
            Итого: <strong>{total.toFixed(2)} {"\u20BD"}</strong>
          </p>
        </div>

        <div className="panel">
          <h2>Данные карты</h2>
          <p className="muted">Демо-режим: данные карты не проверяются.</p>
          <form className="form" onSubmit={buy}>
            <label>
              Номер карты
              <input className="input" value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} required />
            </label>
            <label>
              Держатель карты
              <input className="input" value={cardHolder} onChange={(event) => setCardHolder(event.target.value)} required />
            </label>
            <label>
              Срок действия
              <input className="input" value={expiry} onChange={(event) => setExpiry(event.target.value)} required />
            </label>
            <label>
              CVV
              <input className="input" value={cvv} onChange={(event) => setCvv(event.target.value)} required />
            </label>
            <button className="btn" type="submit" disabled={items.length === 0}>
              Приобрести
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}



