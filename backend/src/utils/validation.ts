import type { ZodError, ZodIssue } from "zod";

const FIELD_LABELS: Record<string, string> = {
  email: "email",
  password: "пароль",
  username: "имя пользователя",
  role: "роль",
  currentPassword: "текущий пароль",
  newPassword: "новый пароль",
  title: "название",
  description: "описание",
  genreId: "жанр",
  price: "цена",
  authorName: "автор",
  cardNumber: "номер карты",
  cardHolder: "держатель карты",
  expiry: "срок действия карты",
  cvv: "CVV",
  name: "название",
  rating: "оценка",
  comment: "комментарий",
  trackId: "трек",
  note: "комментарий модератора",
  search: "поисковый запрос",
  minPrice: "минимальная цена",
  maxPrice: "максимальная цена"
};

function getFieldName(issue: ZodIssue): string {
  const lastPart = issue.path.length ? String(issue.path[issue.path.length - 1]) : "поле";
  return FIELD_LABELS[lastPart] ?? lastPart;
}

function issueToMessage(issue: ZodIssue): string {
  const field = getFieldName(issue);

  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") {
        return `Поле «${field}» обязательно для заполнения`;
      }
      return `Поле «${field}» заполнено неверно`;

    case "invalid_string":
      if (issue.validation === "email") {
        return "Введите корректный email";
      }
      if (issue.validation === "url") {
        return `Поле «${field}» должно содержать корректную ссылку`;
      }
      return `Поле «${field}» заполнено неверно`;

    case "invalid_enum_value":
      return `Выберите корректное значение поля «${field}»`;

    case "too_small":
      if (issue.type === "string") {
        return `Поле «${field}» заполнено слишком коротко`;
      }
      if (issue.type === "number") {
        return `Поле «${field}» меньше допустимого значения`;
      }
      return `Поле «${field}» заполнено некорректно`;

    case "too_big":
      if (issue.type === "string") {
        return `Поле «${field}» заполнено слишком длинно`;
      }
      if (issue.type === "number") {
        return `Поле «${field}» больше допустимого значения`;
      }
      return `Поле «${field}» заполнено некорректно`;

    case "custom":
      if (issue.message === "At least one field is required") {
        return "Нужно заполнить хотя бы одно поле";
      }
      return issue.message || "Проверьте правильность заполнения полей";

    default:
      return issue.message || "Проверьте правильность заполнения полей";
  }
}

export function formatZodError(error: ZodError): string {
  const messages = error.issues.map(issueToMessage);
  return [...new Set(messages)].join(", ");
}
