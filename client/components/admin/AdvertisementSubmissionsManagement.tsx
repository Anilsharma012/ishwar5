import React, { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  Badge,
} from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Loader2,
  Search,
  Filter,
  Phone,
  Mail,
  MapPin,
  FileText,
  RefreshCw,
  CheckCircle2,
  Eye,
  XCircle,
  Layers,              // 👈 ye line add karo
} from "lucide-react";

import { format } from "date-fns";

type SubmissionStatus = "new" | "viewed" | "contacted";

type AdvertisementSubmission = {
  _id: string;
  bannerType: string;
  fullName: string;
  email: string;
  phone: string;
  projectName: string;
  location: string;
  projectType: string;
  budget?: string;
  description: string;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type ApiListResponse = {
  success: boolean;
  data?: {
    submissions: AdvertisementSubmission[];
    pagination: Pagination;
  };
  error?: string;
};

type Props = {
  token: string | null;
};

const statusLabel: Record<SubmissionStatus, string> = {
  new: "New",
  viewed: "Viewed",
  contacted: "Contacted",
};

const statusColor: Record<SubmissionStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  viewed: "bg-amber-100 text-amber-700",
  contacted: "bg-emerald-100 text-emerald-700",
};

export default function AdvertisementSubmissionsManagement({ token }: Props) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<AdvertisementSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | SubmissionStatus>(
    "all",
  );
  const [bannerFilter, setBannerFilter] = useState<
    "all" | "home_top" | "home_middle" | "property_detail" | "sidebar"
  >("all");
  const [search, setSearch] = useState("");

  const limit = 20;

  const fetchSubmissions = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (statusFilter !== "all") params.set("status", statusFilter);
      if (bannerFilter !== "all") params.set("bannerType", bannerFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(
        `/api/admin/advertisement/submissions?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Failed to fetch submissions");
      }

      const data: ApiListResponse = await res.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || "Failed to fetch submissions");
      }

      setSubmissions(data.data.submissions || []);
      setPagination(data.data.pagination);
    } catch (err: any) {
      console.error("Error fetching advertisement submissions:", err);
      setError(err.message || "Failed to fetch submissions");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: SubmissionStatus) => {
    if (!token) return;

    try {
      const res = await fetch(
        `/api/admin/advertisement/submissions/${id}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        },
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update status");
      }

      setSubmissions((prev) =>
        prev.map((s) => (s._id === id ? { ...s, status } : s)),
      );
    } catch (err: any) {
      console.error("Error updating status:", err);
      setError(err.message || "Failed to update status");
    }
  };

  const deleteSubmission = async (id: string) => {
    if (!token) return;
    if (!confirm("Delete this submission?")) return;

    try {
      const res = await fetch(
        `/api/admin/advertisement/submissions/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete submission");
      }

      setSubmissions((prev) => prev.filter((s) => s._id !== id));
    } catch (err: any) {
      console.error("Error deleting submission:", err);
      setError(err.message || "Failed to delete submission");
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, bannerFilter]);

  const resetFilters = () => {
    setStatusFilter("all");
    setBannerFilter("all");
    setSearch("");
    setPage(1);
    fetchSubmissions();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayersIcon />
              Advertisement Submissions
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Banner ke niche jo form submit hota hai, uski saari enquiries yaha
              dikhengi.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Logged in as:{" "}
            <span className="font-medium">
              {user?.email || "Admin"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    fetchSubmissions();
                  }
                }}
                className="w-64"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  setPage(1);
                  fetchSubmissions();
                }}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(v: any) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="viewed">Viewed</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={bannerFilter}
                onValueChange={(v: any) => {
                  setBannerFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Banner Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Banners</SelectItem>
                  <SelectItem value="home_top">Home – Top</SelectItem>
                  <SelectItem value="home_middle">Home – Middle</SelectItem>
                  <SelectItem value="property_detail">
                    Property Detail
                  </SelectItem>
                  <SelectItem value="sidebar">Sidebar</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={resetFilters}
                title="Reset filters"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md bg-red-50 text-red-700 px-4 py-2 text-sm">
              {error}
            </div>
          )}

          {/* Table */}
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client / Project</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Banner Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                      Loading submissions...
                    </TableCell>
                  </TableRow>
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      No submissions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="space-y-1">
                        <div className="font-medium">{s.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          {s.projectName}
                        </div>
                        {s.description && (
                          <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
                            <FileText className="w-3 h-3 mt-0.5" />
                            <span className="line-clamp-2">
                              {s.description}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          <span>{s.phone}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          <span>{s.email}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>{s.location}</span>
                        </div>
                        {s.budget && (
                          <div className="text-xs text-muted-foreground">
                            Budget: {s.budget}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {s.bannerType}
                        </Badge>
                        {s.projectType && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {s.projectType}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            "text-xs font-medium " + statusColor[s.status]
                          }
                        >
                          {statusLabel[s.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          <span>
                            {format(
                              new Date(s.createdAt),
                              "dd-MM-yyyy HH:mm",
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="icon"
                          variant="outline"
                          title="Mark viewed"
                          onClick={() => updateStatus(s._id, "viewed")}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="Mark contacted"
                          onClick={() => updateStatus(s._id, "contacted")}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          title="Delete"
                          onClick={() => deleteSubmission(s._id)}
                        >
                          <XCircle className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm">
              <div>
                Page {pagination.page} of {pagination.pages} •{" "}
                {pagination.total} submissions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.pages}
                  onClick={() =>
                    setPage((p) =>
                      pagination ? Math.min(pagination.pages, p + 1) : p + 1,
                    )
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LayersIcon() {
  return <Layers className="w-5 h-5 text-primary" />;
}

function CalendarIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} viewBox="0 0 24 24" />;
}
