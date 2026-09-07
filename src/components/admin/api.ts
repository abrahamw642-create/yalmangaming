/**
 * Yalman Gaming admin — the browser side of `/api/admin/**`.
 *
 * Every editor in the dashboard mutates through this one helper so the shape
 * of a success and the shape of a failure are the same everywhere: either
 * `{ ok: true, data }`, or `{ ok: false, error, fields }` where `fields` maps
 * a form field name to the message that belongs under it.
 *
 * A 401 is handled specially. Sessions expire after twelve hours, and the most
 * confusing possible failure is a save that silently does nothing because the
 * cookie lapsed while the tab sat open — so it is reported as its own message
 * telling the admin to sign in again.
 */

export type AdminError = {
  error: string;
  fields?: Record<string, string>;
};

export type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fields: Record<string, string>; status: number };

type Method = "POST" | "PATCH" | "DELETE";

async function request<T>(
  url: string,
  method: Method,
  body?: unknown,
): Promise<AdminResult<T>> {
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      // The session cookie is httpOnly and same-origin; this is explicit so the
      // request never falls back to omitting it.
      credentials: "same-origin",
    });
  } catch {
    return {
      ok: false,
      error: "Could not reach the server. Check your connection and try again.",
      fields: {},
      status: 0,
    };
  }

  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) {
    return { ok: true, data: payload as T };
  }

  if (response.status === 401) {
    return {
      ok: false,
      error: "Your session has expired. Reload the page and sign in again.",
      fields: {},
      status: 401,
    };
  }

  const error = payload as AdminError | null;
  return {
    ok: false,
    error: error?.error ?? `Request failed (${response.status}).`,
    fields: error?.fields ?? {},
    status: response.status,
  };
}

export function adminPost<T>(url: string, body?: unknown) {
  return request<T>(url, "POST", body);
}

export function adminPatch<T>(url: string, body?: unknown) {
  return request<T>(url, "PATCH", body);
}

export function adminDelete<T>(url: string, body?: unknown) {
  return request<T>(url, "DELETE", body);
}
