import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import OLXStyleHeader from "../components/OLXStyleHeader";
import DynamicFooter from "../components/DynamicFooter";
import BottomNavigation from "../components/BottomNavigation";
import { Loader2, Calendar, User, Eye, Tag } from "lucide-react";

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  featuredImage?: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  category: string;
  tags: string[];
  publishedAt?: Date;
  views: number;
  featured: boolean;
}

export default function Blogs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get("category") || "all",
  );
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchPosts();
  }, [page, selectedCategory]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
      });
      if (selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }

      const response = await fetch(`/api/blog?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPosts(data.data.posts || []);
        setTotalPages(data.data.pagination.pages || 1);

        // Extract categories from first load
        if (page === 1 && selectedCategory === "all") {
          const cats =
            data.data.posts
              ?.map((p: BlogPost) => p.category)
              .filter(
                (c: string, i: number, arr: string[]) => arr.indexOf(c) === i,
              ) || [];
          if (cats.length > 0) {
            setCategories(cats);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching blogs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryFilter = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };

  const handleBlogClick = (slug: string) => {
    navigate(`/blog/${slug}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OLXStyleHeader />

      <main className="flex-1 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Ashish Properties Blog
            </h1>
            <p className="text-lg text-gray-600">
              Latest news, tips, and insights about real estate in Rohtak
            </p>
          </div>

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                FILTER BY CATEGORY
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleCategoryFilter("all")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === "all"
                      ? "bg-red-600 text-white"
                      : "bg-white border border-gray-300 text-gray-700 hover:border-red-300"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryFilter(cat)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedCategory === cat
                        ? "bg-red-600 text-white"
                        : "bg-white border border-gray-300 text-gray-700 hover:border-red-300"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Blog Posts Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-red-600" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">
                No blog posts found. Check back soon!
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {posts.map((post) => (
                  <div
                    key={post._id}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleBlogClick(post.slug)}
                  >
                    {post.featuredImage && (
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-48 object-cover"
                      />
                    )}
                    {!post.featuredImage && (
                      <div className="w-full h-48 bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
                        <span className="text-red-600 font-bold text-4xl">
                          AP
                        </span>
                      </div>
                    )}

                    <div className="p-4">
                      {post.featured && (
                        <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded mb-2">
                          FEATURED
                        </span>
                      )}

                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 hover:text-red-600">
                        {post.title}
                      </h3>

                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {post.excerpt}
                      </p>

                      <div className="text-xs text-gray-500 space-y-1 mb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3" />
                          By {post.author.name}
                        </div>
                        {post.publishedAt && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.publishedAt).toLocaleDateString()}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Eye className="h-3 w-3" />
                          {post.views} views
                        </div>
                      </div>

                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {post.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded"
                            >
                              #{tag}
                            </span>
                          ))}
                          {post.tags.length > 2 && (
                            <span className="text-gray-500 text-xs px-2 py-1">
                              +{post.tags.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
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
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <DynamicFooter />
      <BottomNavigation />
    </div>
  );
}
