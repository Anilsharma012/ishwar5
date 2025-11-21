import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Upload, Download, FileText, CheckCircle, XCircle } from "lucide-react";
import { safeReadResponse, getApiErrorMessage } from "../../lib/response-utils";
import { OsCategory, OsSubcategory } from "@shared/types";

export default function OsBulkImport() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [err, setErr] = useState<string>("");
  const [categories, setCategories] = useState<OsCategory[]>([]);
  const [subcategories, setSubcategories] = useState<OsSubcategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (selectedCategory) {
      fetchSubcategories(selectedCategory);
      setSelectedSubcategory("");
    }
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const res = await fetch("/api/os/categories?active=1");
      const data = await res.json();
      setCategories(data.data || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      setError("Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchSubcategories = async (categorySlug: string) => {
    try {
      setLoadingSubcategories(true);
      const res = await fetch(
        `/api/os/subcategories?cat=${categorySlug}&active=1`,
      );
      const data = await res.json();
      setSubcategories(data.data || []);
    } catch (error) {
      console.error("Failed to fetch subcategories:", error);
      setError("Failed to load subcategories");
    } finally {
      setLoadingSubcategories(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (
        selectedFile.type === "text/csv" ||
        selectedFile.name.endsWith(".csv")
      ) {
        setFile(selectedFile);
        setError("");
        setUploadResult(null);
      } else {
        setError("Please select a CSV file");
        setFile(null);
      }
    }
  };

  async function uploadCsv(file: File) {
    setErr("");
    setError("");
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      // Send category and subcategory as query parameters (multer doesn't parse form fields automatically)
      const queryParams = new URLSearchParams({
        category: selectedCategory,
        subcategory: selectedSubcategory,
      });

      const r = await fetch(
        `/api/admin/os-listings/import?${queryParams.toString()}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      );

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        setErr(data?.error || "Import failed");
        setError(data?.error || `Import failed (${r.status})`);
        return;
      }

      setUploadResult({
        created: data.created,
        updated: data.updated,
        errors: data.errors,
      });

      setFile(null);
      // Reset file input
      const fileInput = document.getElementById("csv-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    } catch (error: any) {
      setErr("Network error");
      setError(`Failed to upload file: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  const handleUpload = async () => {
    if (!file || !token) return;
    await uploadCsv(file);
  };

  const downloadTemplate = () => {
    const template = `name,phone,address,lat,lng,photo1,photo2,photo3,photo4,open,close,active
Rohtak Plumbing Services,9999999999,Sector 3 Rohtak,28.8955,76.6066,https://example.com/photo1.jpg,,,09:00,18:00,true
City Electrical Works,9876543210,Model Town Rohtak,28.8955,76.6066,https://example.com/photo2.jpg,,,08:00,19:00,true`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `other-services-template-${selectedCategory}-${selectedSubcategory}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Bulk Import Service Listings
        </h2>
        <p className="text-gray-600">
          Import multiple service listings from a CSV file
        </p>
      </div>

      {/* Category & Subcategory Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Category & Subcategory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={loadingCategories}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#C70000] focus:border-[#C70000] disabled:bg-gray-100"
              >
                <option value="">
                  {loadingCategories ? "Loading..." : "Select a category"}
                </option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subcategory <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                disabled={!selectedCategory || loadingSubcategories}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#C70000] focus:border-[#C70000] disabled:bg-gray-100"
              >
                <option value="">
                  {loadingSubcategories
                    ? "Loading..."
                    : !selectedCategory
                      ? "Select category first"
                      : "Select a subcategory"}
                </option>
                {subcategories.map((subcat) => (
                  <option key={subcat._id} value={subcat.slug}>
                    {subcat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCategory && selectedSubcategory && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <p className="text-green-700 text-sm">
                ✓ Selected: <strong>{selectedCategory}</strong> →{" "}
                <strong>{selectedSubcategory}</strong>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            CSV Format Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-gray-900 mb-2">
              Required Columns:
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">name</code>{" "}
                <span className="text-red-500">*</span> - Business/Service name
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">phone</code>{" "}
                <span className="text-red-500">*</span> - Contact phone number
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">address</code>{" "}
                <span className="text-red-500">*</span> - Full address
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">lat</code>{" "}
                <span className="text-red-500">*</span> - Latitude coordinate
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">lng</code>{" "}
                <span className="text-red-500">*</span> - Longitude coordinate
              </li>
            </ul>
            <h4 className="font-medium text-gray-900 mb-2 mt-4">
              Optional Columns:
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">
                  photo1, photo2, photo3, photo4
                </code>{" "}
                - Photo URLs (up to 4 photos)
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">open</code> -
                Opening time (format: HH:MM, default: 09:00)
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">close</code> -
                Closing time (format: HH:MM, default: 18:00)
              </li>
              <li>
                <code className="bg-gray-100 px-2 py-1 rounded">active</code> -
                true/false for active status (default: true)
              </li>
            </ul>
            <p className="text-sm text-gray-600 mt-4">
              <strong>Note:</strong> Category and subcategory are selected above
              and will be automatically applied to all rows in the CSV.
            </p>
          </div>

          <div>
            <Button
              onClick={downloadTemplate}
              variant="outline"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Upload CSV File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#C70000] file:text-white hover:file:bg-[#A60000]"
            />
          </div>

          {file && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-600">
                Selected file: <strong>{file.name}</strong> (
                {Math.round(file.size / 1024)} KB)
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {err && <div className="text-red-600 text-sm mt-2">{err}</div>}

          {!selectedCategory || !selectedSubcategory ? (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-blue-700 text-sm">
                ℹ️ Please select category and subcategory above before uploading
              </p>
            </div>
          ) : null}

          <Button
            onClick={handleUpload}
            disabled={
              !file || uploading || !selectedCategory || !selectedSubcategory
            }
            className="w-full bg-[#C70000] hover:bg-[#A60000] disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload and Import
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Upload Results */}
      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-green-600 font-medium">
                Import completed: {uploadResult.created} created,{" "}
                {uploadResult.updated || 0} updated!
              </p>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="text-red-600 font-medium mb-2">
                  <XCircle className="h-4 w-4 inline mr-1" />
                  Errors during import:
                </h4>
                <ul className="text-red-600 text-sm space-y-1">
                  {uploadResult.errors.map((error: any, index: number) => (
                    <li key={index}>
                      • {typeof error === "string" ? error : error.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-sm text-gray-600">
              <p>
                <strong>Summary:</strong>
              </p>
              <ul className="list-disc list-inside">
                <li>Created: {uploadResult.created} listings</li>
                <li>Updated: {uploadResult.updated || 0} listings</li>
                <li>Errors: {uploadResult.errors?.length || 0}</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Notes */}
      <Card>
        <CardContent className="p-4 bg-blue-50 border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Important Notes:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • All rows will be imported under the selected category and
              subcategory
            </li>
            <li>
              • Coordinates should be in decimal format (e.g., 28.8955, 76.6066)
            </li>
            <li>• Times should be in 24-hour format (e.g., 09:00, 18:00)</li>
            <li>• Phone numbers should be numeric (10-15 digits)</li>
            <li>• Photo URLs should be publicly accessible</li>
            <li>• Do NOT include catSlug or subSlug columns in your CSV</li>
            <li>• Duplicate entries will create separate listings</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
