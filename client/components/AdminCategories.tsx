import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Hash,
  Upload,
  FileText,
  Download,
} from "lucide-react";

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  count?: number;
  excelFile?: ExcelFile;
}

interface ExcelFile {
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
}

interface Category {
  _id?: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  subcategories: Subcategory[];
  order: number;
  active: boolean;
  count?: number;
  excelFile?: ExcelFile;
}

interface AdminCategoriesProps {
  token: string;
}

export default function AdminCategories({ token }: AdminCategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    name: "",
    slug: "",
    icon: "🏠",
    description: "",
    subcategories: [],
    order: 1,
    active: true,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [showExcelUpload, setShowExcelUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingTarget, setUploadingTarget] = useState<{
    categoryId?: string;
    subcategoryId?: string;
  }>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const { data } = await (
        await import("../lib/response-utils")
      ).safeReadResponse(response);

      if (data && data.success) {
        const list = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.data?.categories)
            ? data.data.categories
            : [];
        const normalized = list.map((cat: any) => ({
          ...cat,
          icon: cat.icon ?? cat.iconUrl,
          order: cat.order ?? cat.sortOrder,
          active: cat.active ?? cat.isActive,
        }));
        setCategories(normalized);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const payload = {
        name: newCategory.name,
        iconUrl: (newCategory as any).icon || "/placeholder.svg",
        sortOrder: (newCategory as any).order ?? 999,
        isActive: (newCategory as any).active ?? true,
      };

      const response = await fetch("/api/admin/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const { data } = await (
        await import("../lib/response-utils")
      ).safeReadResponse(response);

      if (data && data.success) {
        const createdCategoryId = data.data?.category?._id || data.data?._id;
        // create subcategories if any
        if (
          newCategory.subcategories &&
          newCategory.subcategories.length &&
          createdCategoryId
        ) {
          for (let i = 0; i < (newCategory.subcategories || []).length; i++) {
            const sub = (newCategory.subcategories || [])[i];
            try {
              await fetch("/api/admin/subcategories", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  categoryId: createdCategoryId,
                  name: sub.name,
                  iconUrl: (newCategory as any).icon || "/placeholder.svg",
                  sortOrder: i + 1,
                  isActive: true,
                }),
              });
            } catch (e) {
              console.warn("Failed to create subcategory", sub, e);
            }
          }
        }

        fetchCategories();
        window.dispatchEvent(new Event("categories:updated"));
        setNewCategory({
          name: "",
          slug: "",
          icon: "🏠",
          description: "",
          subcategories: [],
          order: 1,
          active: true,
        });
        setShowAddForm(false);
      }
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  const handleUpdateCategory = async (
    categoryId: string,
    updateData: Partial<Category>,
  ) => {
    try {
      // Map icon -> iconUrl and order -> sortOrder if present
      const payload: any = { ...updateData };
      if ((payload as any).icon) {
        payload.iconUrl = (payload as any).icon;
        delete payload.icon;
      }
      if ((payload as any).order !== undefined) {
        payload.sortOrder = (payload as any).order;
        delete payload.order;
      }

      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const { data } = await (
        await import("../lib/response-utils")
      ).safeReadResponse(response);

      if (data && data.success) {
        fetchCategories();
        setEditingCategory(null);
        window.dispatchEvent(new Event("categories:updated"));
      }
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const { data } = await (
        await import("../lib/response-utils")
      ).safeReadResponse(response);

      if (data && data.success) {
        fetchCategories();
        window.dispatchEvent(new Event("categories:updated"));
      } else {
        alert((data && data.error) || "Failed to delete category");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleExcelFileUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    if (!uploadingTarget.categoryId && !uploadingTarget.subcategoryId) {
      alert("Please select a category or subcategory");
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (uploadingTarget.categoryId) {
        formData.append("categoryId", uploadingTarget.categoryId);
      }
      if (uploadingTarget.subcategoryId) {
        formData.append("subcategoryId", uploadingTarget.subcategoryId);
      }

      const endpoint = uploadingTarget.subcategoryId
        ? "/api/admin/os-subcategories/upload-excel"
        : "/api/admin/os-categories/upload-excel";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const { data } = await (
        await import("../lib/response-utils")
      ).safeReadResponse(response);

      if (data && data.success) {
        alert("Excel file uploaded successfully!");
        fetchCategories();
        setShowExcelUpload(false);
        setSelectedFile(null);
        setUploadingTarget({});
      } else {
        alert((data && data.error) || "Failed to upload file");
      }
    } catch (error) {
      console.error("Error uploading Excel file:", error);
      alert("Failed to upload Excel file");
    } finally {
      setUploading(false);
    }
  };

  const toggleCategoryExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#C70000] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Categories Management
        </h1>
        <div className="flex space-x-2">
          <Button
            onClick={() => setShowExcelUpload(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Excel
          </Button>
          <Button
            data-testid="add-category-btn"
            onClick={() => setShowAddForm(true)}
            className="bg-[#C70000] hover:bg-[#A60000] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Excel Upload Form */}
      {showExcelUpload && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Upload Excel File</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select File
              </label>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select Category
              </label>
              <select
                value={uploadingTarget.categoryId || ""}
                onChange={(e) =>
                  setUploadingTarget({
                    categoryId: e.target.value,
                    subcategoryId: undefined,
                  })
                }
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="">-- Select Category --</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {uploadingTarget.categoryId && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select Subcategory (Optional)
                </label>
                <select
                  value={uploadingTarget.subcategoryId || ""}
                  onChange={(e) =>
                    setUploadingTarget({
                      ...uploadingTarget,
                      subcategoryId: e.target.value || undefined,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="">-- Select Subcategory (Optional) --</option>
                  {categories
                    .find((c) => c._id === uploadingTarget.categoryId)
                    ?.subcategories.map((subcat) => (
                      <option key={subcat.id} value={subcat.id}>
                        {subcat.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                onClick={handleExcelFileUpload}
                disabled={uploading || !selectedFile}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload File"}
              </Button>
              <Button
                onClick={() => {
                  setShowExcelUpload(false);
                  setSelectedFile(null);
                  setUploadingTarget({});
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Form */}
      {showAddForm && (
        <div
          data-testid="add-category-form"
          className="bg-white p-6 rounded-lg shadow border"
        >
          <h3 className="text-lg font-semibold mb-4">Add New Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <Input
                data-testid="category-name-input"
                value={newCategory.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setNewCategory({
                    ...newCategory,
                    name,
                    slug: generateSlug(name),
                  });
                }}
                placeholder="Category name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Slug</label>
              <Input
                value={newCategory.slug}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, slug: e.target.value })
                }
                placeholder="category-slug"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Icon</label>
              <Input
                value={newCategory.icon}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, icon: e.target.value })
                }
                placeholder="🏠"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Order</label>
              <Input
                type="number"
                value={newCategory.order}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    order: parseInt(e.target.value),
                  })
                }
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">
                Description
              </label>
              <Input
                value={newCategory.description}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    description: e.target.value,
                  })
                }
                placeholder="Category description"
              />
            </div>
          </div>
          <div className="flex space-x-2 mt-4">
            <Button
              data-testid="save-category-btn"
              onClick={handleCreateCategory}
              className="bg-[#C70000] hover:bg-[#A60000] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Category
            </Button>
            <Button onClick={() => setShowAddForm(false)} variant="outline">
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div data-testid="categories-list" className="space-y-4">
        {categories.map((category) => (
          <div
            key={category._id}
            data-testid={`category-item-${category._id}`}
            className="bg-white rounded-lg shadow border"
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => toggleCategoryExpanded(category._id!)}
                    className="p-1"
                  >
                    {expandedCategories.has(category._id!) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-lg">{category.icon}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {category.description}
                    </p>
                    {category.excelFile && (
                      <div className="mt-2 flex items-center space-x-2 text-xs text-blue-600">
                        <FileText className="h-3 w-3" />
                        <span>{category.excelFile.fileName}</span>
                        <a
                          href={category.excelFile.fileUrl}
                          download
                          className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-400 mt-1">
                      <span>Slug: {category.slug}</span>
                      <span>Order: {category.order}</span>
                      <span className="flex items-center">
                        <Hash className="h-3 w-3 mr-1" />
                        {category.count || 0} properties
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      category.active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {category.active ? "Active" : "Inactive"}
                  </span>
                  <Button
                    data-testid={`edit-category-${category._id}`}
                    onClick={() => setEditingCategory(category._id!)}
                    variant="outline"
                    size="sm"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    data-testid={`delete-category-${category._id}`}
                    onClick={() => handleDeleteCategory(category._id!)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Subcategories */}
              {expandedCategories.has(category._id!) && (
                <div className="mt-4 pl-8 border-l-2 border-gray-100">
                  <h4 className="font-medium text-gray-700 mb-2">
                    Subcategories ({category.subcategories.length})
                  </h4>
                  <div className="space-y-2">
                    {category.subcategories.map((subcategory) => (
                      <div
                        key={subcategory.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded"
                      >
                        <div className="flex-1">
                          <span className="font-medium">
                            {subcategory.name}
                          </span>
                          <p className="text-sm text-gray-500">
                            {subcategory.description}
                          </p>
                          {subcategory.excelFile && (
                            <div className="mt-2 flex items-center space-x-2 text-xs text-blue-600">
                              <FileText className="h-3 w-3" />
                              <span>{subcategory.excelFile.fileName}</span>
                              <a
                                href={subcategory.excelFile.fileUrl}
                                download
                                className="text-blue-500 hover:text-blue-700 flex items-center gap-1"
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </a>
                            </div>
                          )}
                          <span className="text-xs text-gray-400">
                            Slug: {subcategory.slug}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {subcategory.count || 0} properties
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Category</h3>
            {(() => {
              const category = categories.find(
                (c) => c._id === editingCategory,
              );
              if (!category) return null;

              return (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Active
                    </label>
                    <select
                      value={category.active ? "true" : "false"}
                      onChange={(e) => {
                        const updatedCategory = {
                          ...category,
                          active: e.target.value === "true",
                        };
                        handleUpdateCategory(category._id!, updatedCategory);
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setEditingCategory(null)}
                      variant="outline"
                      className="flex-1"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
