/* =========================
   Environment detection
========================= */
const detectEnvironment = () => {
  if (typeof window === "undefined") return "server";

  const { hostname, port } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1" || port === "8080") {
    return "development";
  }
  if (hostname.includes(".fly.dev")) return "fly";
  if (hostname.includes(".netlify.app")) return "netlify";
  return "production";
};

/* =========================
   API base URL
========================= */
const getApiBaseUrl = () => {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (envBase && envBase.trim()) return envBase.trim();

  const environment = detectEnvironment();
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    switch (environment) {
      case "development":
      case "fly":
      case "netlify":
        return ""; // dev servers usually proxy /api → backend
      case "production":
      default:
        if (port && port !== "80" && port !== "443") return `${protocol}//${hostname}`;
        return "";
    }
  }
  return "";
};

const API_BASE_URL = (getApiBaseUrl() || "").replace(/\/+$/, "");
const environment = detectEnvironment();

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  timeout: environment === "development" ? 8000 : 15000,
  retryAttempts: 2,
  retryDelay: 1000,
  environment,
};

/* =========================
   URL composer (prevents /api/api)
========================= */
export const createApiUrl = (endpoint: string): string => {
  const base = (API_CONFIG.baseUrl || "").replace(/\/+$/, "");
  let e = (endpoint || "").trim();
  if (!e.startsWith("/")) e = `/${e}`;

  const endpointHasApi = e.startsWith("/api/");
  const baseHasApi = /\/api$/.test(base);

  const path = endpointHasApi ? e : baseHasApi ? e : `/api${e}`;
  return `${base}${path}`;
};

/* =========================
   Token helpers
========================= */
const getStoredToken = (): string | null => {
  try {
    const keys = ["adminToken", "authToken", "token", "userToken"];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && v.trim()) return v.trim();
    }
    const userRaw = localStorage.getItem("user");
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw);
        const fromUser =
          u?.token || u?.accessToken || u?.jwt || u?.data?.token || u?.data?.accessToken;
        if (typeof fromUser === "string" && fromUser.trim()) return fromUser.trim();
      } catch {}
    }
    // Cookie fallback
    const cookie = (name: string) =>
      (document.cookie || "")
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(name + "="))
        ?.split("=")[1];
    const fromCookie =
      cookie("authToken") || cookie("token") || cookie("accessToken") || cookie("jwt");
    if (fromCookie) {
      try {
        localStorage.setItem("token", fromCookie);
      } catch {}
      return fromCookie;
    }
    return null;
  } catch {
    return null;
  }
};

/* =========================
   Core request with timeout/retry
========================= */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<{ data: any; status: number; ok: boolean }> => {
  const url = createApiUrl(endpoint);

  const isBuilderPreview =
    typeof window !== "undefined" &&
    window.location.hostname.includes("projects.builder.codes");

  const controller = new AbortController();

  const baseTimeout =
    endpoint.includes("chat/unread-count") || endpoint.includes("stream")
      ? Math.max(API_CONFIG.timeout, 30000)
      : API_CONFIG.timeout;

  const extendedEndpoints = ["upload", "categories", "subcategories", "create", "delete"];
  const isExtended = extendedEndpoints.some((k) => endpoint.includes(k));
  let finalTimeout = isExtended ? Math.max(baseTimeout, 45000) : baseTimeout;

  if (isBuilderPreview && !API_CONFIG.baseUrl) {
    finalTimeout = Math.min(finalTimeout, 8000);
  }

  const timeoutId = setTimeout(() => {
    try {
      // @ts-ignore
      controller.abort(new Error("timeout"));
    } catch {
      controller.abort();
    }
  }, finalTimeout);

  try {
    const callerHeaders = (options.headers as Record<string, string>) ?? {};
    const stored = getStoredToken();

    const defaultHeaders: Record<string, string> = {};
    const hasBody = options.body !== undefined && options.body !== null;
    const bodyIsFormData =
      hasBody && typeof FormData !== "undefined" && options.body instanceof FormData;

    if (hasBody && !bodyIsFormData) defaultHeaders["Content-Type"] = "application/json";
    if (stored && !("Authorization" in callerHeaders)) {
      defaultHeaders.Authorization = `Bearer ${stored}`;
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...defaultHeaders, ...callerHeaders },
      credentials: "include",
    });

    clearTimeout(timeoutId);

    // safe parse
    let responseData: any = {};
    try {
      const clone = response.clone();
      const t = await clone.text();
      if (t && t.trim()) {
        try {
          responseData = JSON.parse(t);
        } catch {
          responseData = { raw: t };
        }
      }
    } catch {
      try {
        responseData = await response.json();
      } catch {
        responseData = {};
      }
    }

    return { data: responseData, status: response.status, ok: response.ok };
  } catch (error: any) {
    clearTimeout(timeoutId);

    const msg = String(error?.message || "").toLowerCase();
    const retriable =
      error?.name === "AbortError" ||
      msg.includes("timeout") ||
      msg.includes("failed to fetch") ||
      msg.includes("network error");

    if (retriable && retryCount < API_CONFIG.retryAttempts) {
      await new Promise((r) => setTimeout(r, API_CONFIG.retryDelay));
      return apiRequest(endpoint, options, retryCount + 1);
    }

    const isBuilderPreviewNoApi =
      typeof window !== "undefined" &&
      window.location.hostname.includes("projects.builder.codes") &&
      !API_CONFIG.baseUrl;

    if (isBuilderPreviewNoApi) {
      return { data: null, status: 0, ok: false } as any;
    }

    return { data: null, status: 0, ok: false } as any;
  }
};

/* =========================
   Result Type
========================= */
export type ApiResult<T = any> = { success: boolean; data?: T; error?: string };

/* =========================
   Internal: normalize/compat
   (makes old pages that read data.success work)
========================= */
const makeCompat = (success: boolean, payload: any, error?: string) => {
  // If payload is object, inject flags; if array/primitive, wrap in { items: ... }
  let compat: any;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    compat = { ...payload, success, ...(error ? { error } : {}) };
  } else if (Array.isArray(payload)) {
    compat = { items: payload, count: payload.length, success, ...(error ? { error } : {}) };
  } else if (payload == null) {
    compat = { success, ...(error ? { error } : {}) };
  } else {
    compat = { value: payload, success, ...(error ? { error } : {}) };
  }
  return compat;
};

/* =========================
   Options type (backward + new)
========================= */
type ApiOptions = {
  auth?: boolean;
  token?: string;
  headers?: Record<string, string>;
  query?: Record<string, any>;
  bodyIsFormData?: boolean;
};

/* =========================
   Helper to resolve token/opts
========================= */
const resolveOpts = (
  tokenOrOpts?: string | ApiOptions
): { token?: string; opts: ApiOptions } => {
  if (!tokenOrOpts) return { token: undefined, opts: {} };
  if (typeof tokenOrOpts === "string") return { token: tokenOrOpts, opts: {} };
  return { token: tokenOrOpts.token, opts: tokenOrOpts };
};

const addQuery = (endpoint: string, query?: Record<string, any>) => {
  if (!query || !Object.keys(query).length) return endpoint;
  const usp = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    usp.append(k, String(v));
  });
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}${usp.toString()}`;
};

/* =========================
   Admin helpers (optional)
========================= */
export const adminApi = {
  getStats: async (token: string) => {
    const res = await apiRequest("admin/stats", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        res.data?.error ||
          res.data?.message ||
          (typeof res.data?.raw === "string" ? res.data.raw : "") ||
          `HTTP ${res.status}`
      );
    }
    return res.data;
  },

  getUsers: async (token: string, limit = 10) => {
    const res = await apiRequest(`admin/users?limit=${limit}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        res.data?.error ||
          res.data?.message ||
          (typeof res.data?.raw === "string" ? res.data.raw : "") ||
          `HTTP ${res.status}`
      );
    }
    return res.data;
  },

  getProperties: async (token: string, limit = 10) => {
    const res = await apiRequest(`admin/properties?limit=${limit}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(
        res.data?.error ||
          res.data?.message ||
          (typeof res.data?.raw === "string" ? res.data.raw : "") ||
          `HTTP ${res.status}`
      );
    }
    return res.data;
  },
};

/* =========================
   Generic API wrapper (consistent + compat)
========================= */
export const api = {
  get: async <T = any>(
    endpoint: string,
    tokenOrOpts?: string | ApiOptions
  ): Promise<ApiResult<T>> => {
    const { token, opts } = resolveOpts(tokenOrOpts);
    const authToken =
      opts.auth === false ? undefined : token ?? (opts.auth ? getStoredToken() : getStoredToken());

    const headers: Record<string, string> = authToken
      ? { Authorization: `Bearer ${authToken}`, ...(opts.headers || {}) }
      : { ...(opts.headers || {}) };

    const ep = addQuery(endpoint, opts.query);
    try {
      const res = await apiRequest(ep, { method: "GET", headers });
      const payload = res.data?.data ?? res.data;
      if (!res.ok) {
        const errMsg =
          payload?.error ||
          payload?.message ||
          (typeof payload?.raw === "string" ? payload.raw : "") ||
          `HTTP ${res.status}`;
        return { success: false, data: makeCompat(false, payload, errMsg) as any, error: errMsg };
      }
      return { success: true, data: makeCompat(true, payload) as any };
    } catch (err: any) {
      const msg = err?.message || "Network error";
      return { success: false, data: makeCompat(false, null, msg) as any, error: msg };
    }
  },

  post: async <T = any>(
    endpoint: string,
    data?: any,
    tokenOrOpts?: string | ApiOptions
  ): Promise<ApiResult<T>> => {
    const { token, opts } = resolveOpts(tokenOrOpts);
    const authToken =
      opts.auth === false ? undefined : token ?? (opts.auth ? getStoredToken() : getStoredToken());

    const headers: Record<string, string> = authToken
      ? { Authorization: `Bearer ${authToken}`, ...(opts.headers || {}) }
      : { ...(opts.headers || {}) };

    const body =
      opts.bodyIsFormData || (typeof FormData !== "undefined" && data instanceof FormData)
        ? data
        : data !== undefined
        ? JSON.stringify(data)
        : undefined;

    const res = await apiRequest(endpoint, { method: "POST", body, headers });
    const payload = res.data?.data ?? res.data;

    if (!res.ok) {
      const errMsg =
        payload?.error ||
        payload?.message ||
        (typeof payload?.raw === "string" ? payload.raw : "") ||
        `HTTP ${res.status}`;
      return { success: false, data: makeCompat(false, payload, errMsg) as any, error: errMsg };
    }
    return { success: true, data: makeCompat(true, payload) as any };
  },

  put: async <T = any>(
    endpoint: string,
    data?: any,
    tokenOrOpts?: string | ApiOptions
  ): Promise<ApiResult<T>> => {
    const { token, opts } = resolveOpts(tokenOrOpts);
    const authToken =
      opts.auth === false ? undefined : token ?? (opts.auth ? getStoredToken() : getStoredToken());

    const headers: Record<string, string> = authToken
      ? { Authorization: `Bearer ${authToken}`, ...(opts.headers || {}) }
      : { ...(opts.headers || {}) };

    const body =
      opts.bodyIsFormData || (typeof FormData !== "undefined" && data instanceof FormData)
        ? data
        : data !== undefined
        ? JSON.stringify(data)
        : undefined;

    const res = await apiRequest(endpoint, { method: "PUT", body, headers });
    const payload = res.data?.data ?? res.data;

    if (!res.ok) {
      const errMsg =
        payload?.error ||
        payload?.message ||
        (typeof payload?.raw === "string" ? payload.raw : "") ||
        `HTTP ${res.status}`;
      return { success: false, data: makeCompat(false, payload, errMsg) as any, error: errMsg };
    }
    return { success: true, data: makeCompat(true, payload) as any };
  },

  delete: async <T = any>(
    endpoint: string,
    tokenOrOpts?: string | ApiOptions,
    data?: any
  ): Promise<ApiResult<T>> => {
    const { token, opts } = resolveOpts(tokenOrOpts);
    const authToken =
      opts.auth === false ? undefined : token ?? (opts.auth ? getStoredToken() : getStoredToken());

    const headers: Record<string, string> = authToken
      ? { Authorization: `Bearer ${authToken}`, ...(opts.headers || {}) }
      : { ...(opts.headers || {}) };

    const body =
      opts.bodyIsFormData || (typeof FormData !== "undefined" && data instanceof FormData)
        ? data
        : data !== undefined
        ? JSON.stringify(data)
        : undefined;

    const res = await apiRequest(endpoint, { method: "DELETE", body, headers });
    const payload = res.data?.data ?? res.data;

    if (!res.ok) {
      const errMsg =
        payload?.error ||
        payload?.message ||
        (typeof payload?.raw === "string" ? payload.raw : "") ||
        `HTTP ${res.status}`;
      return { success: false, data: makeCompat(false, payload, errMsg) as any, error: errMsg };
    }
    return { success: true, data: makeCompat(true, payload) as any };
  },
};

// Optional alias
// @ts-ignore
(api as any).del = (endpoint: string, tokenOrOpts?: string | ApiOptions) =>
  (api as any).delete(endpoint, tokenOrOpts);
