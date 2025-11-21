// server/middleware/auth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || process.env.JWT_PRIVATE_KEY || "your-secret-key";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userType?: string; // admin | staff | seller | agent | user
  email?: string;
  role?: string;     // super_admin | content_manager | ...
  isAdmin?: boolean; // optional boolean claim support
}

/* ---------- helpers ---------- */
const toLower = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : v);

const pickToken = (req: Request): string | null => {
  const auth = (req.headers["authorization"] as string) || "";
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();

  const xAuth = (req.headers["x-auth-token"] as string) || "";
  const xAdmin = (req.headers["x-admin-token"] as string) || "";
  if (xAuth) return xAuth.trim();
  if (xAdmin) return xAdmin.trim();

  const cookieTok =
    (req as any)?.cookies?.token ||
    (req as any)?.cookies?.authToken ||
    (req as any)?.cookies?.adminToken;
  return cookieTok ? String(cookieTok).trim() : null;
};

// pull id from multiple shapes: {_id,id,userId}, user._id, sub
const idFromPayload = (p: any): string | null => {
  const id =
    p?.userId ??
    p?.id ??
    p?._id ??
    p?.user?.id ??
    p?.user?._id ??
    p?.sub ??
    null;
  return id ? String(id) : null;
};

const getUserTypeFromPayload = (p: any): string | undefined => {
  const t =
    p?.userType ??
    p?.type ??
    p?.accountType ??
    p?.user?.userType ??
    p?.user?.type ??
    p?.user?.accountType;
  return t ? String(t).toLowerCase() : undefined;
};

const getRoleFromPayload = (p: any): string | undefined => {
  const r = p?.role ?? p?.staffRole ?? p?.permissionRole ?? p?.user?.role;
  return r ? String(r).toLowerCase() : undefined;
};

const getIsAdminBool = (p: any): boolean => {
  return Boolean(
    p?.isAdmin ||
      p?.admin === true ||
      p?.user?.isAdmin === true ||
      ["admin", "staff"].includes(String(getUserTypeFromPayload(p) || "").toLowerCase())
  );
};

/* ---------- core verifier ---------- */
const verifyAndAttach = (req: Request, res: Response): { ok: boolean } => {
  const token = pickToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: "Access token required" });
    return { ok: false };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const uid = idFromPayload(decoded);
    if (!uid) {
      res.status(401).json({ success: false, error: "Invalid token (no user id)" });
      return { ok: false };
    }

    (req as any).userId   = uid;
    (req as any).userType = getUserTypeFromPayload(decoded);
    (req as any).role     = getRoleFromPayload(decoded);
    (req as any).email    = decoded?.email || decoded?.user?.email;
    (req as any).isAdmin  = getIsAdminBool(decoded);

    return { ok: true };
  } catch (e) {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
    return { ok: false };
  }
};

/* ---------- exported guards ---------- */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const r = verifyAndAttach(req, res);
  if (r.ok) next();
};

export const requireAuthAny = authenticateToken;

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const r = verifyAndAttach(req, res);
  if (!r.ok) return;

  const userType = (toLower((req as any).userType) as string) || "";
  const role     = (toLower((req as any).role) as string) || "";
  const isAdmin  = Boolean((req as any).isAdmin);

  // allow admin/staff OR privileged role OR explicit isAdmin boolean
  const isAdminType = userType === "admin" || userType === "staff";
  const isPrivRole  = ["super_admin", "admin"].includes(role);

  if (!isAdminType && !isPrivRole && !isAdmin) {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
};

export const requireSellerOrAgent = (req: Request, res: Response, next: NextFunction) => {
  const r = verifyAndAttach(req, res);
  if (!r.ok) return;

  const userType = ((req as any).userType || "").toLowerCase();
  if (!["seller", "agent", "admin", "staff"].includes(userType)) {
    return res.status(403).json({ success: false, error: "Seller or agent access required" });
  }
  next();
};

export const requireBuyer = (req: Request, res: Response, next: NextFunction) => {
  const r = verifyAndAttach(req, res);
  if (!r.ok) return;

  const userType = ((req as any).userType || "").toLowerCase();
  if (!["seller", "user", "agent", "customer", "admin", "staff"].includes(userType)) {
    return res.status(401).json({ success: false, error: "Login with a user/seller account" });
  }
  next();
};

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const r = verifyAndAttach(req, res);
    if (!r.ok) return;

    const userType = ((req as any).userType || "").toLowerCase();
    const role = ((req as any).role || "").toLowerCase();

    if (userType === "admin") return next();

    if (userType === "staff") {
      const rolePermissions: Record<string, string[]> = {
        super_admin: ["*"],
        content_manager: ["content.view", "content.create", "content.manage", "blog.manage", "blog.view"],
        sales_manager: ["users.view", "sellers.manage", "sellers.verify", "sellers.view", "payments.view", "packages.manage", "ads.view", "analytics.view"],
        support_executive: ["users.view", "support.view", "reports.view", "content.view"],
        admin: ["content.view", "users.view", "ads.view", "analytics.view"],
      };
      const perms = rolePermissions[role] || [];
      if (perms.includes("*") || perms.includes(permission)) return next();
    }

    return res.status(403).json({ success: false, error: `Permission required: ${permission}` });
  };
};
