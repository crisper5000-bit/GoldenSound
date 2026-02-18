import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const redirect = new URLSearchParams(location.search).get("redirect") ?? "/";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await login(email, password);
      navigate(redirect, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка входа");
    }
  };

  return (
    <section className="auth-page panel">
      <h1>Вход</h1>
      <p className="muted">Для входа администратора используйте `admin / admin`.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Email
          <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Пароль
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="state state--error">{error}</p>}
        <button className="btn" type="submit">
          Войти
        </button>
      </form>
      <p>
        Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
      </p>
    </section>
  );
}
