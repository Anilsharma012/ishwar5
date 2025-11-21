import React, { useState } from "react";
import { Button } from "../ui/button";
import { api } from "../../lib/api";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";

interface BlogPost {
  _id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  category: string;
  tags: string[];
  status: "draft" | "pending_review" | "published" | "archived";
  featured: boolean;
  seo?: {
    title?: string;
    description?: string;
  };
}

interface BlogPostFormProps {
  post?: BlogPost | null;
  onClose: () => void;
  categories: string[];
}

const DEFAULT_CATEGORIES = [
  "Technology",
  "Real Estate",
  "Property Tips",
  "Market News",
  "Investment Guide",
  "Lifestyle",
];

export default function BlogPostForm({
  post,
  onClose,
  categories,
}: BlogPostFormProps) {
  // agar parent se categories nahin aa rahi to default use karo
  const categoryOptions =
    categories && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const [formData, setFormData] = useState<BlogPost>(
    post || {
      title: "",
      slug: "",
      excerpt: "",
      content: "",
      featuredImage: "",
      category: categoryOptions[0] || "Technology",
      tags: [],
      status: "draft",
      featured: false,
      seo: {
        title: "",
        description: "",
      },
    },
  );

  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(
    post?.featuredImage || "",
  );

  /* =========================
     Helpers
  ========================== */

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // New post pe title change karte hi slug bana do
      if (name === "title" && !post) {
        const slug = value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-");

        setFormData((prev) => ({
          ...prev,
          slug,
          seo: {
            // agar SEO title empty hai to auto-fill karo
            title: prev.seo?.title || value,
            description: prev.seo?.description || prev.excerpt || "",
          },
        }));
      }
    }
  };

  const handleSeoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      seo: {
        ...(prev.seo || {}),
        [name]: value,
      },
    }));
  };

  const addTag = () => {
    const cleaned = newTag.trim();
    if (cleaned && !formData.tags.includes(cleaned)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, cleaned],
      }));
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /* =========================
     Image Upload (direct to backend)
  ========================== */

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.featuredImage || null;

    const formDataUpload = new FormData();
    formDataUpload.append("file", imageFile);

    try {
      const getToken = () => {
        const keys = ["authToken", "token", "adminToken", "userToken"];
        for (const k of keys) {
          const v = localStorage.getItem(k);
          if (v && v.trim()) return v.trim();
        }
        const userRaw = localStorage.getItem("user");
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw);
            const fromUser =
              u?.token ||
              u?.accessToken ||
              u?.jwt ||
              u?.data?.token ||
              u?.data?.accessToken;
            if (typeof fromUser === "string" && fromUser.trim())
              return fromUser.trim();
          } catch {
            // ignore
          }
        }
        return null;
      };

      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("/api/admin/blog/upload-image", {
        method: "POST",
        body: formDataUpload,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        let errorMsg = `Upload failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error) errorMsg = errorData.error;
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      return data.data?.url || null;
    } catch (err) {
      console.error("Image upload error:", err);
      setError(
        `Image upload failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      // Continue without the image
      return null;
    }
  };

  /* =========================
     Submit
  ========================== */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (
        !formData.title ||
        !formData.slug ||
        !formData.content ||
        !formData.excerpt
      ) {
        setError("Please fill in all required fields");
        setLoading(false);
        return;
      }

      let imageUrl = formData.featuredImage || null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const submitData = {
        ...formData,
        featuredImage: imageUrl,
        // safe fallback category
        category: formData.category || categoryOptions[0] || "Technology",
        seo: {
          title: formData.seo?.title || formData.title,
          description:
            formData.seo?.description || formData.excerpt || formData.title,
        },
      };

      const url = post ? `/admin/blog/${post._id}` : "/admin/blog";

      const response = post
        ? await api.put(url, submitData)
        : await api.post(url, submitData);

      // api wrapper tumhara usually { success, data, error } type return karta h
      if (response?.success || response?.data) {
        onClose();
      } else {
        setError(
          (response as any)?.error ||
            "Failed to save blog post (empty response)",
        );
      }
    } catch (apiErr: any) {
      console.error("Blog save error:", apiErr);
      setError(
        apiErr?.data?.error ||
          apiErr?.message ||
          "Failed to save blog post",
      );
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     JSX
  ========================== */

  return (
    <div className="space-y-6">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Blog List
      </button>

      <h1 className="text-3xl font-bold">
        {post ? "Edit Blog Post" : "Create New Blog Post"}
      </h1>

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Blog post title"
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Slug *
            </label>
            <input
              type="text"
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
              placeholder="url-friendly-slug"
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Excerpt *
          </label>
          <textarea
            name="excerpt"
            value={formData.excerpt}
            onChange={handleInputChange}
            placeholder="Short excerpt for preview"
            rows={2}
            className="w-full border rounded-lg px-3 py-2"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Content *
          </label>
          <textarea
            name="content"
            value={formData.content}
            onChange={handleInputChange}
            placeholder="Full blog post content"
            rows={8}
            className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">
              Category *
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              Status
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="draft">Draft</option>
              <option value="pending_review">Pending Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Tags</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Enter tag and press Enter or click Add"
              className="flex-1 border rounded-lg px-3 py-2"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">
            Featured Image
          </label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-red-300 transition-colors">
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-48 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview("");
                    setImageFile(null);
                    setFormData((prev) => ({
                      ...prev,
                      featuredImage: "",
                    }));
                  }}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center">
                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                <span className="text-sm font-medium text-gray-700">
                  Click to upload image
                </span>
                <span className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="featured"
              checked={formData.featured}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="font-medium">Mark as Featured</span>
          </label>
        </div>

        <div className="border-t pt-4 space-y-3">
          <div>
            <label className="block text-sm font-semibold mb-2">
              SEO Title
            </label>
            <input
              type="text"
              name="title"
              value={formData.seo?.title || ""}
              onChange={handleSeoChange}
              placeholder="SEO optimized title"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">
              SEO Description
            </label>
            <input
              type="text"
              name="description"
              value={formData.seo?.description || ""}
              onChange={handleSeoChange}
              placeholder="SEO optimized description"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Blog Post"
            )}
          </Button>
          <Button variant="outline" onClick={onClose} type="button">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
