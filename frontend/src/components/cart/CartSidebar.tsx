import { Link, useNavigate } from "react-router-dom";
import { useAuth, useCart } from "../../context";

export function CartSidebar() {
  const { items, total, removeFromCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <aside className="cart-sidebar">
      <h3>Корзина</h3>
      <div className="cart-sidebar__items">
        {items.length === 0 && <p className="muted">Пока пусто</p>}
        {items.map((item) => (
          <div className="cart-item" key={item.trackId}>
            <div>
              <p>{item.title}</p>
              <p className="muted">{item.authorName}</p>
            </div>
            <div className="cart-item__right">
              <span>{item.price.toFixed(2)} {"\u20BD"}</span>
              <button className="btn-link" onClick={() => void removeFromCart(item.trackId)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="cart-sidebar__footer">
        <p>
          Итого: <strong>{total.toFixed(2)} {"\u20BD"}</strong>
        </p>
        {user ? (
          <Link className="btn" to="/checkout">
            Перейти к оплате
          </Link>
        ) : (
          <button className="btn" onClick={() => navigate("/login?redirect=/checkout")}>Перейти к оплате</button>
        )}
      </div>
    </aside>
  );
}



