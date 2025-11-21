// src/lib/apiClient.ts

type Json = Record<string, any>;

/** Prefer Vite env; fallback to "/api" for same-origin proxy */
const BASE_URL =
  (import.meta.env && (import.meta.env as any).VITE_API_BASE_URL) || "/api";

/** ---------- Token helpers (works for admin/seller/user) ---------- */
function readAnyToken(): string {
  const keys = ["adminToken", "sellerToken", "userToken", "authToken", "token"];
  try {
    for (const k of keys) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return v;
    }
  } catch {
    /* ignore storage errors */
  }
  return "";
}

function clearAllTokens() {
  const keys = ["adminToken", "sellerToken", "userToken", "authToken", "token"];
  try {
    for (const k of keys) {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

function setPrimaryToken(tok: string | null) {
  try {
    if (tok) localStorage.setItem("adminToken", tok);
    else clearAllTokens();
  } catch {
    /* ignore */
  }
}

/** Best-effort decode to check exp without throwing */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload?.exp;
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch {
    return false;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname || "";
  const to = path.includes("/seller")
    ? "/seller-login?reason=expired"
    : path.includes("/admin")
    ? "/admin/login?reason=expired"
    : "/login?reason=expired";
  window.location.replace(to);
}

/** Optional console debug toggle via localStorage.setItem('DEBUG_API','1') */
const debug = (...args: any[]) => {
  try {
    if (localStorage.getItem("DEBUG_API")) {
      // eslint-disable-next-line no-console
      console.log("[api]", ...args);
    }
  } catch {
    /* ignore */
  }
};

export const apiClient = {
  /** Base can be "/api" (reverse proxy) or full origin (https://api.xyz.com) */
  baseUrl: String(BASE_URL || "/api"),

  /**
   * Build final URL safely. Prevents "/api/api/..." duplication.
   * Examples:
   *  base="/api", endpoint="api/admin/categories"  -> "/api/admin/categories"
   *  base="/api", endpoint="/api/auth/login"       -> "/api/auth/login"
   *  base="https://api.site.com", endpoint="/v1/x" -> "https://api.site.com/v1/x"
   */
  createUrl(endpoint: string) {
    let base = String(this.baseUrl || "/api").replace(/\/+$/, "");
    let ep = String(endpoint || "");

    // strip leading slashes for consistent joining
    ep = ep.replace(/^\/+/, "");

    // 🩹 if base ends with '/api' and endpoint starts with 'api/', drop one 'api'
    if (base.endsWith("/api") && ep.startsWith("api/")) {
      ep = ep.slice(4); // remove "api/"
    }

    const url = `${base}/${ep}`.replace(/([^:]\/)\/+/g, "$1");
    return url;
  },

  async request<T = any>(input: string, init: RequestInit = {}): Promise<T> {
    const url = this.createUrl(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const callerHeaders = (init.headers as Record<string, string>) || {};
      let token = readAnyToken();

      // Skip obviously expired tokens
      if (token && isJwtExpired(token)) {
        clearAllTokens();
        token = "";
      }

      const isForm =
        init.body &&
        typeof FormData !== "undefined" &&
        init.body instanceof FormData;

      const headers: Record<string, string> = {
        ...(isForm ? {} : { "Content-Type": "application/json" }),
        Accept: "application/json",
        ...callerHeaders,
      };

      if (token && !("Authorization" in headers)) {
        headers.Authorization = `Bearer ${token}`;
      }

      debug(init.method || "GET", url);

      const res = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      let raw: string | null = null;
      try {
        raw = await res.text();
      } catch {
        raw = null;
      } finally {
        clearTimeout(timeout);
      }

      let data: any = null;
      if (raw && raw.length) {
        try {
          data = JSON.parse(raw);
        } catch {
          // non-JSON response (e.g., plain text)
          data = raw;
        }
      }

      if (!res.ok) {
        // Treat both 401 and 403 as auth failures
        const msg = String(
          (data && (data.message || data.error)) || ""
        ).toLowerCase();

        if (
          res.status === 401 ||
          res.status === 403 ||
          /invalid|expired token/.test(msg)
        ) {
          clearAllTokens();
          redirectToLogin();
        }

        const err: any = new Error(
          (data && (data.message || data.error)) || `HTTP ${res.status}`
        );
        err.status = res.status;
        err.data = data;
        err.url = url;
        throw err;
      }

      return (data as T) ?? ({} as T);
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError") {
        const e: any = new Error("Request timed out");
        e.status = 0;
        throw e;
      }
      throw err;
    }
  },

  get<T = any>(input: string) {
    return this.request<T>(input, { method: "GET" });
  },

  post<T = any>(input: string, body?: Json | FormData) {
    const isForm =
      typeof FormData !== "undefined" && body instanceof FormData;
    return this.request<T>(input, {
      method: "POST",
      body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });
  },

  put<T = any>(input: string, body?: Json | FormData) {
    const isForm =
      typeof FormData !== "undefined" && body instanceof FormData;
    return this.request<T>(input, {
      method: "PUT",
      body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T = any>(input: string, body?: Json | FormData) {
    const isForm =
      typeof FormData !== "undefined" && body instanceof FormData;
    return this.request<T>(input, {
      method: "PATCH",
      body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = any>(input: string) {
    return this.request<T>(input, { method: "DELETE" });
  },

  // optional helpers
  setToken(token: string) {
    setPrimaryToken(token);
  },
  clearToken() {
    clearAllTokens();
  },

  /** Create a cloned client with different base (rarely needed) */
  withBase(newBase: string) {
    const clone = { ...this, baseUrl: String(newBase || "").trim() || "/api" };
    return clone;
  },
};
