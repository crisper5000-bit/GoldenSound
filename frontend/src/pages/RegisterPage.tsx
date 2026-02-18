import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context";

export function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"USER" | "SELLER">("USER");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      await register({ email, password, username, role });
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Ошибка регистрации");
    }
  };

  return (
    <section className="auth-page panel">
      <h1>Регистрация</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Email
          <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Имя пользователя
          <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} />
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

        <fieldset className="radio-row">
          <legend>Тип аккаунта</legend>
          <label>
            <input type="radio" checked={role === "USER"} onChange={() => setRole("USER")} /> Пользователь
          </label>
          <label>
            <input type="radio" checked={role === "SELLER"} onChange={() => setRole("SELLER")} /> Продавец
          </label>
        </fieldset>

        {error && <p className="state state--error">{error}</p>}

        <button className="btn" type="submit">
          Создать аккаунт
        </button>
      </form>
      <p>
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </section>
  );
}
