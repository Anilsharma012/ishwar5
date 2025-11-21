import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Edit2, Eye, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { api } from "../../lib/api";
import BlogPostForm from "./BlogPostForm";
import { useNavigate } from "react-router-dom";

type BlogPost = {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  category: string;
  tags: string[];
  status: "draft" | "pending_review" | "published" | "archived";
  featured: boolean;
  seo?: { title?: string; description?: string };
  views: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

type PaginationData = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const DEFAULT_CATEGORIES = [
  "Technology",
  "Real Estate",
  "Property Tips",
  "Market News",
  "Investment Guide",
  "Lifestyle",
];

const STATUS_TABS: Array<BlogPost["status"] | "all"> = [
  "all",
  "draft",
  "pending_review",
  "published",
  "archived",
];

export default function AdminBlogManagement() {
  const nav = useNavigate();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] =
    useState<BlogPost["status"] | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string>("");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const categoryOptions = useMemo(
    () => (categories.length ? categories : DEFAULT_CATEGORIES),
    [categories],
  );

  const hasToken = () => {
    const t =
      localStorage.getItem("adminToken") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("token") ||
      localStorage.getItem("userToken");
    return !!(t && t.trim());
  };

  useEffect(() => {
    // no token? go login
    if (!hasToken()) {
      nav("/auth");
      return;
    }
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, page]);

  const fetchPosts = async () => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
      });
      if (selectedStatus !== "all") params.append("status", selectedStatus);

      const res = await api.get<{
        posts: BlogPost[];
        categories: string[];
        pagination: PaginationData;
      }>(`/admin/blog?${params.toString()}`);

      if (!res.success) {
        // unauthorized → login
        const msg = (res.error || "").toLowerCase();
        if (msg.includes("unauthorized") || msg.includes("token")) {
          nav("/auth");
          return;
        }
        setErr(res.error || "Failed to load blogs");
        return;
      }

      setPosts(res.data?.posts || []);
      setCategories(res.data?.categories || []);
      if (res.data?.pagination) setPagination(res.data.pagination);
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Delete this blog post?")) return;
    const res = await api.delete(`/admin/blog/${postId}`);
    if (!res.success) {
      alert(res.error || "Failed to delete");
      return;
    }
    // optimistic UI
    setPosts((prev) => prev.filter((p) => p._id !== postId));
    // optionally refresh page counts
    fetchPosts();
  };

  const handleEdit = (post: BlogPost) => {
    setSelectedPost(post);
    setShowForm(true);
  };

  const handleNewBlog = () => {
    setSelectedPost(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedPost(null);
    fetchPosts();
  };

  const getStatusBadgeColor = (status: BlogPost["status"]) => {
    const colors: Record<BlogPost["status"], string> = {
      draft: "bg-gray-100 text-gray-800",
      pending_review: "bg-yellow-100 text-yellow-800",
      published: "bg-green-100 text-green-800",
      archived: "bg-red-100 text-red-800",
    };
    return colors[status];
  };

  if (showForm) {
    return (
      <BlogPostForm
        post={selectedPost}
        onClose={handleFormClose}
        categories={categoryOptions}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Blog Management</h1>
        <Button onClick={handleNewBlog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Blog
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((status) => (
          <button
            key={status}
            onClick={() => {
              setSelectedStatus(status);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === status
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {(status as string).replace("_", " ").toUpperCase()}
          </button>
        ))}
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded">
          {err}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No blog posts found</p>
          <Button onClick={handleNewBlog}>Create First Blog</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post._id}
              className="border rounded-lg p-4 hover:border-red-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg text-gray-800 truncate">
                      {post.title}
                    </h3>
                    <span
                      className={`inline-block px-3 py-1 rounded text-xs font-semibold whitespace-nowrap ${getStatusBadgeColor(post.status)}`}
                    >
                      {post.status.replace("_", " ")}
                    </span>
                    {post.featured && (
                      <span className="inline-block px-3 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800 whitespace-nowrap">
                        FEATURED
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {post.excerpt}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>Slug: {post.slug}</span>
                    <span>Category: {post.category}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {post.views} views
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(post)}
                    className="gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(post._id)}
                    className="text-red-600 hover:text-red-700"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded ${
                    page === p
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>

          <Button
            variant="outline"
            disabled={page === pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
