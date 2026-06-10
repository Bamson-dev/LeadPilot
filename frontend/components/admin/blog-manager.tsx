"use client";

import Link from "next/link";
import RichEmailEditor from "@/components/RichEmailEditor";

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  featured?: boolean;
  category?: string;
  read_time?: number;
  created_at: string;
};

type BlogManagerProps = {
  blogView: "list" | "editor";
  setBlogView: (view: "list" | "editor") => void;
  blogPosts: BlogPostRow[];
  blogLoading: boolean;
  loadBlogPosts: () => Promise<void>;
  openNewPost: () => void;
  openEditPost: (post: BlogPostRow) => void;
  deleteBlogPost: (id: string) => void;
  blogTitle: string;
  setBlogTitle: (v: string) => void;
  blogSlug: string;
  setBlogSlug: (v: string) => void;
  blogExcerpt: string;
  setBlogExcerpt: (v: string) => void;
  blogContent: string;
  setBlogContent: (v: string) => void;
  blogCoverImage: string;
  setBlogCoverImage: (v: string) => void;
  blogCategory: string;
  setBlogCategory: (v: string) => void;
  blogTags: string;
  setBlogTags: (v: string) => void;
  blogMetaTitle: string;
  setBlogMetaTitle: (v: string) => void;
  blogMetaDesc: string;
  setBlogMetaDesc: (v: string) => void;
  blogStatus: "draft" | "published";
  blogFeatured: boolean;
  setBlogFeatured: (v: boolean) => void;
  blogSaving: boolean;
  blogMsg: string;
  editingPost: { id: string } | null;
  saveBlogPost: (publishNow?: boolean) => void;
  generateSlug: (title: string) => string;
};

export function BlogManager(props: BlogManagerProps) {
  const {
    blogView,
    setBlogView,
    blogPosts,
    blogLoading,
    loadBlogPosts,
    openNewPost,
    openEditPost,
    deleteBlogPost,
    blogTitle,
    setBlogTitle,
    blogSlug,
    setBlogSlug,
    blogExcerpt,
    setBlogExcerpt,
    blogContent,
    setBlogContent,
    blogCoverImage,
    setBlogCoverImage,
    blogCategory,
    setBlogCategory,
    blogTags,
    setBlogTags,
    blogMetaTitle,
    setBlogMetaTitle,
    blogMetaDesc,
    setBlogMetaDesc,
    blogStatus,
    blogFeatured,
    setBlogFeatured,
    blogSaving,
    blogMsg,
    editingPost,
    saveBlogPost,
    generateSlug,
  } = props;

  return (
    <div
      style={{
        background: "#111118",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#F2F1FF", margin: 0 }}>
            Blog Manager
          </h3>
          <p style={{ fontSize: 11, color: "#555570", marginTop: 3 }}>
            Write and publish articles to leadthur.com/blog
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {blogView === "editor" && (
            <button
              type="button"
              onClick={() => {
                setBlogView("list");
                void loadBlogPosts();
              }}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 700,
                color: "#8888A8",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              ← All Articles
            </button>
          )}
          <button
            type="button"
            onClick={openNewPost}
            style={{
              background: "#7C3AED",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            + New Article
          </button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {blogView === "list" && (
          <>
            {blogLoading ? (
              <div style={{ textAlign: "center", padding: "32px 0", fontSize: 13, color: "#555570" }}>
                Loading articles...
              </div>
            ) : blogPosts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✍️</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#F2F1FF", marginBottom: 8 }}>
                  No articles yet
                </div>
                <div style={{ fontSize: 13, color: "#555570", marginBottom: 20 }}>
                  Click New Article to write your first post
                </div>
              </div>
            ) : (
              <div>
                {blogPosts.map((post) => (
                  <div
                    key={post.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "14px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 100,
                            background:
                              post.status === "published"
                                ? "rgba(16,185,129,0.1)"
                                : "rgba(255,255,255,0.05)",
                            color: post.status === "published" ? "#10B981" : "#8888A8",
                            border: `1px solid ${
                              post.status === "published"
                                ? "rgba(16,185,129,0.2)"
                                : "rgba(255,255,255,0.08)"
                            }`,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {post.status}
                        </span>
                        {post.featured && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 100,
                              background: "rgba(245,158,11,0.1)",
                              color: "#F59E0B",
                              border: "1px solid rgba(245,158,11,0.2)",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            Featured
                          </span>
                        )}
                        {post.category && (
                          <span style={{ fontSize: 10, color: "#A78BFA", fontWeight: 600 }}>
                            {post.category}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "#F2F1FF",
                          marginBottom: 4,
                          lineHeight: 1.4,
                        }}
                      >
                        {post.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#555570" }}>
                        {post.read_time} min read ·{" "}
                        {new Date(post.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {post.status === "published" && ` · leadthur.com/blog/${post.slug}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => openEditPost(post)}
                        style={{
                          background: "rgba(124,58,237,0.1)",
                          border: "1px solid rgba(124,58,237,0.2)",
                          borderRadius: 6,
                          padding: "5px 12px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#A78BFA",
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Edit
                      </button>
                      {post.status === "published" && (
                        <Link
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: "rgba(16,185,129,0.08)",
                            border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: 6,
                            padding: "5px 12px",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#10B981",
                            cursor: "pointer",
                            fontFamily: "Inter, sans-serif",
                            textDecoration: "none",
                          }}
                        >
                          View
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteBlogPost(post.id)}
                        style={{
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "#EF4444",
                          cursor: "pointer",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {blogView === "editor" && (
          <div>
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
                onClick={() => saveBlogPost(false)}
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
                onClick={() => saveBlogPost(true)}
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
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  background:
                    blogMsg.includes("success") ||
                    blogMsg.includes("published") ||
                    blogMsg.includes("saved")
                      ? "rgba(16,185,129,0.08)"
                      : "rgba(239,68,68,0.08)",
                  border: `1px solid ${
                    blogMsg.includes("success") ||
                    blogMsg.includes("published") ||
                    blogMsg.includes("saved")
                      ? "rgba(16,185,129,0.2)"
                      : "rgba(239,68,68,0.2)"
                  }`,
                  borderRadius: 8,
                  fontSize: 12,
                  color:
                    blogMsg.includes("success") ||
                    blogMsg.includes("published") ||
                    blogMsg.includes("saved")
                      ? "#10B981"
                      : "#EF4444",
                  fontWeight: 600,
                }}
              >
                {blogMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
