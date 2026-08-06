"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import RichEmailEditor from "@/components/RichEmailEditor";
import {
  AdminLoading,
  AdminPanel,
  adminLabelClass,
} from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAdminToken } from "@/services/admin-api";
import { getApiUrl } from "@/utils/env";
import { cn } from "@/utils/utils";

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  featured?: boolean;
  category?: string;
  read_time?: number;
  created_at: string;
  excerpt?: string;
  cover_image?: string;
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
  content?: string;
};

type BlogPostFull = BlogPostRow & {
  content: string;
};

/** @deprecated Props are ignored — BlogManager manages its own state internally. */
type BlogManagerProps = Record<string, unknown>;

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function adminHeaders(): HeadersInit {
  const token = getAdminToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function BlogManager(_props?: BlogManagerProps) {
  const [blogView, setBlogView] = useState<"list" | "editor">("list");
  const [blogPosts, setBlogPosts] = useState<BlogPostRow[]>([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editingPost, setEditingPost] = useState<{ id: string } | null>(null);
  const [blogTitle, setBlogTitle] = useState("");
  const [blogSlug, setBlogSlug] = useState("");
  const [blogExcerpt, setBlogExcerpt] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [blogCoverImage, setBlogCoverImage] = useState("");
  const [blogCategory, setBlogCategory] = useState("");
  const [blogTags, setBlogTags] = useState("");
  const [blogMetaTitle, setBlogMetaTitle] = useState("");
  const [blogMetaDesc, setBlogMetaDesc] = useState("");
  const [blogStatus, setBlogStatus] = useState<"draft" | "published">("draft");
  const [blogFeatured, setBlogFeatured] = useState(false);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogMsg, setBlogMsg] = useState("");
  const [listSuccessMsg, setListSuccessMsg] = useState("");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  const apiUrl = getApiUrl();

  const loadBlogPosts = useCallback(async () => {
    if (!apiUrl) return;
    setBlogLoading(true);
    try {
      const res = await fetch(`${apiUrl}/admin/blog/posts`, {
        headers: adminHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as { posts?: BlogPostRow[] };
        setBlogPosts(data.posts || []);
      }
    } catch {
      /* silent */
    } finally {
      setBlogLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadBlogPosts();
  }, [loadBlogPosts]);

  function resetForm() {
    setEditingPost(null);
    setBlogTitle("");
    setBlogSlug("");
    setBlogExcerpt("");
    setBlogContent("");
    setBlogCoverImage("");
    setBlogCategory("");
    setBlogTags("");
    setBlogMetaTitle("");
    setBlogMetaDesc("");
    setBlogStatus("draft");
    setBlogFeatured(false);
    setBlogMsg("");
  }

  function openNewPost() {
    resetForm();
    setBlogView("editor");
  }

  function populateFormFromPost(post: BlogPostFull) {
    setEditingPost({ id: post.id });
    setBlogTitle(post.title || "");
    setBlogSlug(post.slug || "");
    setBlogExcerpt(post.excerpt || "");
    setBlogContent(post.content || "");
    setBlogCoverImage(post.cover_image || "");
    setBlogCategory(post.category || "");
    setBlogTags((post.tags || []).join(", "));
    setBlogMetaTitle(post.meta_title || "");
    setBlogMetaDesc(post.meta_description || "");
    setBlogStatus((post.status as "draft" | "published") || "draft");
    setBlogFeatured(post.featured || false);
    setBlogMsg("");
  }

  async function openEditPost(post: BlogPostRow) {
    if (!apiUrl) return;

    setBlogView("editor");
    setEditorLoading(true);
    setBlogMsg("");

    try {
      const res = await fetch(`${apiUrl}/admin/blog/posts/${post.id}`, {
        headers: adminHeaders(),
      });

      if (res.ok) {
        const data = (await res.json()) as BlogPostFull;
        populateFormFromPost(data);
      } else {
        populateFormFromPost({
          ...post,
          content: post.content || "",
        });
        setBlogMsg("Could not load full article. Some fields may be incomplete.");
      }
    } catch {
      populateFormFromPost({
        ...post,
        content: post.content || "",
      });
      setBlogMsg("Could not load full article. Check your connection.");
    } finally {
      setEditorLoading(false);
    }
  }

  function backToList() {
    resetForm();
    setBlogView("list");
  }

  async function saveBlogPost(publishNow?: boolean) {
    if (!apiUrl) return;

    if (!blogTitle || !blogContent) {
      setBlogMsg("Title and content are required.");
      return;
    }

    setBlogSaving(true);
    setBlogMsg("");

    const payload = {
      title: blogTitle,
      slug: blogSlug || generateSlug(blogTitle),
      excerpt: blogExcerpt,
      content: blogContent,
      cover_image: blogCoverImage,
      category: blogCategory,
      tags: blogTags
        ? blogTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      meta_title: blogMetaTitle || blogTitle,
      meta_description: blogMetaDesc || blogExcerpt,
      status: publishNow ? "published" : blogStatus,
      featured: blogFeatured,
    };

    const isEditing = Boolean(editingPost);

    try {
      const url = isEditing
        ? `${apiUrl}/admin/blog/posts/${editingPost!.id}`
        : `${apiUrl}/admin/blog/posts`;

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: adminHeaders(),
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { success?: boolean; post?: { id: string }; error?: string };

      if (data.success) {
        if (publishNow) setBlogStatus("published");

        if (isEditing) {
          const successText = publishNow
            ? "Article published successfully."
            : "Article updated successfully.";
          resetForm();
          setBlogView("list");
          setListSuccessMsg(successText);
          await loadBlogPosts();
          setTimeout(() => setListSuccessMsg(""), 4000);
        } else {
          setBlogMsg(publishNow ? "Article published successfully." : "Article saved as draft.");
          if (data.post) setEditingPost(data.post);
          await loadBlogPosts();
        }
      } else {
        setBlogMsg(data.error || "Failed to save.");
      }
    } catch {
      setBlogMsg("Failed to save. Check your connection.");
    } finally {
      setBlogSaving(false);
    }
  }

  async function deleteBlogPost(id: string) {
    if (!apiUrl) return;
    if (!window.confirm("Delete this article? This cannot be undone.")) return;

    try {
      await fetch(`${apiUrl}/admin/blog/posts/${id}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      await loadBlogPosts();
      setBlogView("list");
    } catch {
      /* silent */
    }
  }

  async function handleCoverImageUpload(file: File) {
    const token = getAdminToken();
    if (!apiUrl || !token) {
      alert("Admin session expired. Please log in again.");
      return;
    }

    setCoverUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`${apiUrl}/admin/blog/upload-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = (await res.json()) as {
        success?: boolean;
        url?: string;
        error?: string;
      };

      if (data.url) {
        setBlogCoverImage(data.url);
      } else {
        alert(data.error || "Upload failed. Try again.");
      }
    } catch {
      alert("Upload failed. Check your connection.");
    } finally {
      setCoverUploading(false);
    }
  }

  return (
    <AdminPanel
      title="Blog Manager"
      description="Write and publish articles to leadthur.com/blog"
      action={
        <Button type="button" size="sm" onClick={openNewPost}>
          + New Article
        </Button>
      }
      className="mt-0"
    >
        {blogView === "list" && (
          <>
            {listSuccessMsg && (
              <Alert variant="success" className="mb-4">
                {listSuccessMsg}
              </Alert>
            )}

            {blogLoading ? (
              <AdminLoading label="Loading articles..." />
            ) : blogPosts.length === 0 ? (
              <EmptyState
                title="No articles yet"
                description="Click New Article to write your first post."
              />
            ) : (
              <div>
                {blogPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-start justify-between gap-3 border-b border-[var(--lt-border)] py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          status={post.status === "published" ? "active" : "paused"}
                          label={post.status}
                        />
                        {post.featured && (
                          <StatusBadge status="processing" label="Featured" />
                        )}
                        {post.category && (
                          <span className="text-[10px] font-semibold text-[var(--lt-accent-soft)]">
                            {post.category}
                          </span>
                        )}
                      </div>
                      <div className="mb-1 text-sm font-bold leading-snug text-[var(--lt-text)]">
                        {post.title}
                      </div>
                      <div className="text-[11px] text-[var(--lt-text-subtle)]">
                        {post.read_time} min read ·{" "}
                        {new Date(post.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {post.status === "published" && ` · leadthur.com/blog/${post.slug}`}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => void openEditPost(post)}
                      >
                        Edit
                      </Button>
                      {post.status === "published" && (
                        <Button variant="outline" size="sm" className="h-7 text-[11px]" asChild>
                          <Link href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                            View
                          </Link>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => void deleteBlogPost(post.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {blogView === "editor" && (
          <div>
            <Button type="button" variant="outline" size="sm" className="mb-4" onClick={backToList}>
              ← Back to Articles
            </Button>

            {editorLoading ? (
              <AdminLoading label="Loading article..." />
            ) : (
              <>
                {editingPost && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#A78BFA",
                      marginBottom: 14,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    Editing article
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#8888A8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                    }}
                  >
                    Article Title
                  </label>
                  <input
                    value={blogTitle}
                    onChange={(e) => {
                      setBlogTitle(e.target.value);
                      if (!editingPost) setBlogSlug(generateSlug(e.target.value));
                      if (!blogMetaTitle) setBlogMetaTitle(e.target.value);
                    }}
                    placeholder="How to Find 1,000 Business Contacts in 60 Seconds"
                    style={{
                      width: "100%",
                      background: "#0A0A10",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#F2F1FF",
                      fontFamily: "Inter, sans-serif",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#8888A8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                    }}
                  >
                    URL Slug
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#555570", whiteSpace: "nowrap" }}>
                      leadthur.com/blog/
                    </span>
                    <input
                      value={blogSlug}
                      onChange={(e) =>
                        setBlogSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                      }
                      placeholder="how-to-find-business-contacts"
                      style={{
                        flex: 1,
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#A78BFA",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#8888A8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                    }}
                  >
                    Excerpt (shown on blog listing)
                  </label>
                  <textarea
                    value={blogExcerpt}
                    onChange={(e) => setBlogExcerpt(e.target.value)}
                    placeholder="A short summary of the article. Shows on the blog listing page and in Google search results."
                    rows={2}
                    style={{
                      width: "100%",
                      background: "#0A0A10",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#F2F1FF",
                      fontFamily: "Inter, sans-serif",
                      outline: "none",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#8888A8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                    }}
                  >
                    Cover Image URL
                  </label>

                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    style={{ display: "none" }}
                    disabled={coverUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        void handleCoverImageUpload(file);
                      }
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                    style={{
                      background: coverUploading ? "#1A1A24" : "rgba(124,58,237,0.12)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      borderRadius: 8,
                      padding: "10px 16px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: coverUploading ? "#555570" : "#A78BFA",
                      cursor: coverUploading ? "not-allowed" : "pointer",
                      fontFamily: "Inter, sans-serif",
                      marginBottom: 10,
                    }}
                  >
                    {coverUploading ? "Uploading..." : "Upload Cover Image"}
                  </button>

                  <input
                    value={blogCoverImage}
                    onChange={(e) => setBlogCoverImage(e.target.value)}
                    placeholder="https://example.com/cover-image.png"
                    style={{
                      width: "100%",
                      background: "#0A0A10",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#F2F1FF",
                      fontFamily: "Inter, sans-serif",
                      outline: "none",
                    }}
                  />

                  {blogCoverImage && (
                    <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden", maxHeight: 200 }}>
                      <img
                        src={blogCoverImage}
                        alt="Cover preview"
                        style={{ width: "100%", objectFit: "cover", maxHeight: 200 }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#8888A8",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 6,
                      }}
                    >
                      Category
                    </label>
                    <select
                      value={blogCategory}
                      onChange={(e) => setBlogCategory(e.target.value)}
                      style={{
                        width: "100%",
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    >
                      <option value="">Select category</option>
                      <option value="Lead Generation">Lead Generation</option>
                      <option value="Freelancing">Freelancing</option>
                      <option value="Cold Outreach">Cold Outreach</option>
                      <option value="Nigeria Business">Nigeria Business</option>
                      <option value="SMMA">SMMA</option>
                      <option value="Tools and Software">Tools and Software</option>
                    </select>
                  </div>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#8888A8",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 6,
                      }}
                    >
                      Tags (comma separated)
                    </label>
                    <input
                      value={blogTags}
                      onChange={(e) => setBlogTags(e.target.value)}
                      placeholder="freelancing, lagos, cold outreach, whatsapp marketing"
                      style={{
                        width: "100%",
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(124,58,237,0.06)",
                    border: "1px solid rgba(124,58,237,0.15)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    marginBottom: 14,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#A78BFA", marginBottom: 12 }}>
                    SEO Settings
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#8888A8",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 5,
                      }}
                    >
                      Meta Title (shown in Google)
                    </label>
                    <input
                      value={blogMetaTitle}
                      onChange={(e) => setBlogMetaTitle(e.target.value)}
                      placeholder="Leave blank to use article title"
                      style={{
                        width: "100%",
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 13,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                      }}
                    />
                    <div style={{ fontSize: 10, color: "#555570", marginTop: 4 }}>
                      {blogMetaTitle.length}/60 characters. Keep under 60 for best Google display.
                    </div>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#8888A8",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 5,
                      }}
                    >
                      Meta Description (shown in Google)
                    </label>
                    <textarea
                      value={blogMetaDesc}
                      onChange={(e) => setBlogMetaDesc(e.target.value)}
                      placeholder="Leave blank to use excerpt"
                      rows={2}
                      style={{
                        width: "100%",
                        background: "#0A0A10",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 13,
                        color: "#F2F1FF",
                        fontFamily: "Inter, sans-serif",
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                    <div style={{ fontSize: 10, color: "#555570", marginTop: 4 }}>
                      {blogMetaDesc.length}/160 characters. Keep under 160 for best Google display.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 14,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={blogFeatured}
                      onChange={(e) => setBlogFeatured(e.target.checked)}
                      style={{ width: 16, height: 16 }}
                    />
                    <span style={{ fontSize: 13, color: "#F2F1FF", fontWeight: 600 }}>
                      Featured article
                    </span>
                  </label>
                  <div style={{ fontSize: 11, color: "#555570" }}>
                    Featured articles appear first on the blog homepage
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#8888A8",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 6,
                    }}
                  >
                    Article Content
                  </label>
                  <RichEmailEditor
                    value={blogContent}
                    onChange={setBlogContent}
                    placeholder="Write your article here. Use headings, bold text, links, images, and lists to structure your content for maximum SEO impact."
                  />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => void saveBlogPost(false)}
                    disabled={blogSaving}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8,
                      padding: "10px 20px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#8888A8",
                      cursor: blogSaving ? "not-allowed" : "pointer",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {blogSaving ? "Saving..." : "Save as Draft"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveBlogPost(true)}
                    disabled={blogSaving}
                    style={{
                      background: blogSaving ? "#1A1A24" : "#10B981",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "10px 24px",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: blogSaving ? "not-allowed" : "pointer",
                      fontFamily: "Inter, sans-serif",
                      opacity: blogSaving ? 0.7 : 1,
                    }}
                  >
                    {blogSaving ? "Publishing..." : "Publish Now"}
                  </button>

                  {editingPost && blogStatus === "published" && (
                    <Link
                      href={`/blog/${blogSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: "rgba(124,58,237,0.1)",
                        border: "1px solid rgba(124,58,237,0.2)",
                        borderRadius: 8,
                        padding: "10px 20px",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#A78BFA",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      View Live →
                    </Link>
                  )}
                </div>

                {blogMsg && (
                  <Alert
                    variant={
                      blogMsg.includes("success") ||
                      blogMsg.includes("published") ||
                      blogMsg.includes("saved")
                        ? "success"
                        : "danger"
                    }
                    className="mt-3"
                  >
                    {blogMsg}
                  </Alert>
                )}
              </>
            )}
          </div>
        )}
    </AdminPanel>
  );
}
