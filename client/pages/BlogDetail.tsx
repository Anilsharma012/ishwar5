import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import OLXStyleHeader from "../components/OLXStyleHeader";
import DynamicFooter from "../components/DynamicFooter";
import BottomNavigation from "../components/BottomNavigation";
import { Loader2, Calendar, User, Eye, Tag, ChevronLeft } from "lucide-react";
import { Button } from "../components/ui/button";

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
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
  seo?: {
    title?: string;
    description?: string;
  };
}

export default function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPost();
  }, [slug]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/blog/${slug}`);
      const data = await response.json();

      if (data.success) {
        setPost(data.data);
        // Update page title and meta tags for SEO
        document.title = data.data.seo?.title || data.data.title;
        const metaDescription = document.querySelector(
          'meta[name="description"]',
        );
        if (metaDescription) {
          metaDescription.setAttribute(
            "content",
            data.data.seo?.description || data.data.excerpt,
          );
        }
      } else {
        navigate("/blogs");
      }
    } catch (error) {
      console.error("Error fetching blog post:", error);
      navigate("/blogs");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Blog post not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OLXStyleHeader />

      <main className="flex-1 pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Button */}
          <button
            onClick={() => navigate("/blogs")}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium mb-6"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Blogs
          </button>

          {/* Featured Image */}
          {post.featuredImage && (
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-96 object-cover rounded-lg mb-8"
            />
          )}

          {/* Meta Info */}
          <div className="bg-white rounded-lg p-6 mb-8 border-l-4 border-red-600">
            {post.featured && (
              <span className="inline-block bg-purple-100 text-purple-800 text-xs font-semibold px-3 py-1 rounded mb-3">
                FEATURED
              </span>
            )}

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {post.title}
            </h1>

            <div className="flex flex-wrap gap-4 text-gray-600 text-sm mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>By {post.author.name}</span>
              </div>
              {post.publishedAt && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{post.views} views</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                <span>{post.category}</span>
              </div>
            </div>

            <p className="text-lg text-gray-700 italic">{post.excerpt}</p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg p-8 mb-8 prose prose-sm max-w-none">
            <div
              className="text-gray-700 leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: post.content
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#039;")
                  .replace(/\n/g, "<br/>"),
              }}
            />
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="bg-white rounded-lg p-6 mb-8">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">TAGS</h3>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-red-50 text-red-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-red-100 cursor-pointer transition-colors"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Share & CTA */}
          <div className="bg-red-50 rounded-lg p-6 border border-red-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Looking for properties in Rohtak?
            </h3>
            <p className="text-gray-700 mb-4">
              Browse our latest listings and find your perfect property today.
            </p>
            <Button onClick={() => navigate("/")} className="gap-2">
              View Properties
            </Button>
          </div>
        </div>
      </main>

      <DynamicFooter />
      <BottomNavigation />
    </div>
  );
}
