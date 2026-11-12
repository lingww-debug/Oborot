export async function requestJson<T>(path: string, options: RequestInit) {
  const response = await fetch(path, options);
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok || result === null) {
    const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
      ? result.error
      : "Не удалось выполнить действие. Попробуйте ещё раз.";
    throw new Error(message);
  }
  return result as T;
}

export function jsonRequest(method: string, data: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось выполнить действие.";
