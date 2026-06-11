"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { categoryToSlug } from "@/lib/blog";
import type { BlogPostListItem, TocHeading } from "@/lib/blog-content";
import { formatPostDate } from "@/lib/blog-content";
import { BlogPostCard, blogCardStyles } from "@/components/blog/blog-post-card";

type BlogArticleViewProps = {
  post: {
    title: string;
    slug: string;
    excerpt?: string;
    content: string;
    cover_image?: string;
    author?: string;
    author_title?: string;
    category?: string;
    read_time?: number;
    published_at?: string;
  };
  processedContent: string;
  headings: TocHeading[];
  takeaways: string[];
  relatedPosts: BlogPostListItem[];
  articleUrl: string;
};

export function BlogArticleView({
  post,
  processedContent,
  headings,
  takeaways,
  relatedPosts,
  articleUrl,
}: BlogArticleViewProps) {
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(headings[0]?.id ?? null);
  const [copied, setCopied] = useState(false);

  const authorInitial = post.author?.charAt(0)?.toUpperCase() || "B";

  useEffect(() => {
    const onScroll = () => {
      const article = document.getElementById("blog-article-content");
      if (!article) return;

      const rect = article.getBoundingClientRect();
      const articleTop = window.scrollY + rect.top;
      const articleHeight = article.offsetHeight;
      const viewport = window.innerHeight;
      const scrolled = window.scrollY - articleTop + viewport * 0.2;
      const total = articleHeight - viewport * 0.3;
      const pct = total > 0 ? Math.min(100, Math.max(0, (scrolled / total) * 100)) : 0;
      setProgress(pct);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;

    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  const shareText = useMemo(() => encodeURIComponent(post.title), [post.title]);
  const shareUrl = useMemo(() => encodeURIComponent(articleUrl), [articleUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(articleUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="blog-reading-progress" style={{ width: `${progress}%` }} />

      <main className="blog-article-main">
        <article className="blog-article-container">
          {post.category && (
            <Link
              href={`/blog/category/${categoryToSlug(post.category)}`}
              className="blog-article-category"
            >
              {post.category}
            </Link>
          )}

          <h1 className="blog-article-title">{post.title}</h1>

          {post.excerpt && <p className="blog-article-excerpt">{post.excerpt}</p>}

          <div className="blog-article-author-row">
            <div className="blog-article-author">
              <div className="blog-article-avatar">{authorInitial}</div>
              <div>
                <div className="blog-article-author-name">{post.author}</div>
                <div className="blog-article-author-title">{post.author_title}</div>
              </div>
            </div>
            <div className="blog-article-author-meta">
              {post.published_at && <span>{formatPostDate(post.published_at)}</span>}
              {post.read_time != null && <span>{post.read_time} min read</span>}
            </div>
          </div>

          {post.cover_image && (
            <div className="blog-article-cover">
              <img src={post.cover_image} alt="" />
            </div>
          )}

          {takeaways.length > 0 && (
            <div className="blog-key-takeaways">
              <div className="blog-key-takeaways-title">Key Takeaways</div>
              <ul>
                {takeaways.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {headings.length > 0 && (
            <nav className="blog-toc" aria-label="Table of contents">
              <div className="blog-toc-title">In This Article</div>
              <ul>
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      className={activeId === heading.id ? "blog-toc-link active" : "blog-toc-link"}
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div
            id="blog-article-content"
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />

          <div className="blog-share">
            <a
              href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-share-btn"
            >
              Twitter/X
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-share-btn"
            >
              LinkedIn
            </a>
            <a
              href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="blog-share-btn"
            >
              WhatsApp
            </a>
            <button type="button" onClick={() => void copyLink()} className="blog-share-btn">
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>

          <div className="blog-inline-cta">
            <h2>Ready to find 1,000 businesses to pitch?</h2>
            <p>Try LeadThur free. No signup. No credit card. Results in 60 seconds.</p>
            <a href="https://www.leadthur.com/freetrial">Try LeadThur Free</a>
          </div>

          {relatedPosts.length > 0 && (
            <section className="blog-related">
              <h2 className="blog-related-title">More Articles</h2>
              <div className="blog-post-grid">
                {relatedPosts.map((related) => (
                  <BlogPostCard key={related.id} post={related} />
                ))}
              </div>
            </section>
          )}
        </article>
      </main>

      <style>{blogCardStyles}</style>
      <style>{blogArticleStyles}</style>
    </>
  );
}

const blogArticleStyles = `
  .blog-reading-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 3px;
    background: #7C3AED;
    z-index: 200;
    transition: width 0.1s linear;
  }
  .blog-article-main {
    background: #FFFFFF;
    color: #1F2937;
    font-family: Inter, sans-serif;
  }
  .blog-article-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 24px 80px;
  }
  .blog-article-category {
    display: inline-block;
    font-size: 12px;
    font-weight: 700;
    color: #7C3AED;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-decoration: none;
    margin-bottom: 16px;
  }
  .blog-article-title {
    font-size: 36px;
    font-weight: 800;
    color: #0A0A0A;
    line-height: 1.15;
    margin: 0 0 16px;
    letter-spacing: -0.5px;
  }
  .blog-article-excerpt {
    font-size: 18px;
    color: #6B7280;
    line-height: 1.6;
    margin: 0 0 24px;
  }
  .blog-article-author-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 28px;
    padding-bottom: 28px;
    border-bottom: 1px solid #E5E7EB;
  }
  .blog-article-author {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .blog-article-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #7C3AED;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
  }
  .blog-article-author-name {
    font-size: 14px;
    font-weight: 700;
    color: #0A0A0A;
  }
  .blog-article-author-title {
    font-size: 12px;
    color: #6B7280;
  }
  .blog-article-author-meta {
    display: flex;
    gap: 16px;
    font-size: 13px;
    color: #6B7280;
  }
  .blog-article-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 32px;
    background: #F3F4F6;
  }
  .blog-article-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .blog-key-takeaways {
    background: #F5F3FF;
    border-left: 4px solid #7C3AED;
    border-radius: 0 8px 8px 0;
    padding: 20px 20px 20px 24px;
    margin-bottom: 28px;
  }
  .blog-key-takeaways-title {
    font-size: 16px;
    font-weight: 800;
    color: #7C3AED;
    margin-bottom: 12px;
  }
  .blog-key-takeaways ul {
    margin: 0;
    padding-left: 20px;
    color: #374151;
    line-height: 1.7;
  }
  .blog-key-takeaways li {
    margin-bottom: 8px;
  }
  .blog-toc {
    background: #F9FAFB;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 36px;
  }
  .blog-toc-title {
    font-size: 14px;
    font-weight: 800;
    color: #0A0A0A;
    margin-bottom: 12px;
  }
  .blog-toc ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .blog-toc li + li {
    margin-top: 8px;
  }
  .blog-toc-link {
    color: #374151;
    text-decoration: none;
    font-size: 14px;
    line-height: 1.5;
    display: block;
    padding: 4px 0;
    border-left: 3px solid transparent;
    padding-left: 10px;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .blog-toc-link:hover,
  .blog-toc-link.active {
    color: #7C3AED;
    border-left-color: #7C3AED;
  }
  .blog-content {
    font-size: 17px;
    line-height: 1.75;
    color: #1F2937;
  }
  .blog-content h1 { font-size: 30px; font-weight: 800; color: #0A0A0A; margin: 40px 0 16px; }
  .blog-content h2 {
    font-size: 24px;
    font-weight: 700;
    color: #0A0A0A;
    margin: 48px 0 16px;
    scroll-margin-top: 80px;
  }
  .blog-content h3 {
    font-size: 20px;
    font-weight: 600;
    color: #374151;
    margin: 32px 0 12px;
    scroll-margin-top: 80px;
  }
  .blog-content p { margin: 0 0 20px; }
  .blog-content a { color: #7C3AED; font-weight: 600; text-decoration: none; }
  .blog-content a:hover { text-decoration: underline; }
  .blog-content ul, .blog-content ol { padding-left: 24px; margin: 0 0 20px; }
  .blog-content li { margin-bottom: 8px; }
  .blog-content blockquote {
    border-left: 4px solid #7C3AED;
    background: #F5F3FF;
    padding: 16px;
    margin: 28px 0;
    color: #374151;
    font-style: italic;
  }
  .blog-content strong { color: #0A0A0A; font-weight: 700; }
  .blog-content code {
    background: #F5F3FF;
    border: 1px solid #E9D5FF;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 14px;
    color: #7C3AED;
    font-family: monospace;
  }
  .blog-content pre {
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 20px;
    overflow-x: auto;
    margin: 24px 0;
  }
  .blog-content img { max-width: 100%; border-radius: 10px; margin: 24px 0; display: block; }
  .blog-content table { width: 100%; border-collapse: collapse; margin: 24px 0; border: 1px solid #E5E7EB; }
  .blog-content th {
    background: #F5F3FF;
    color: #7C3AED;
    font-weight: 700;
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid #E5E7EB;
  }
  .blog-content td {
    padding: 12px 16px;
    border-bottom: 1px solid #E5E7EB;
    color: #1F2937;
  }
  .blog-content tbody tr:nth-child(even) td { background: #F9FAFB; }
  .blog-content tbody tr:nth-child(odd) td { background: #FFFFFF; }
  .blog-share {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 48px 0 32px;
    padding-top: 32px;
    border-top: 1px solid #E5E7EB;
  }
  .blog-share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 16px;
    border: 1px solid #7C3AED;
    border-radius: 8px;
    color: #7C3AED;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    background: white;
    cursor: pointer;
    font-family: Inter, sans-serif;
  }
  .blog-share-btn:hover {
    background: #F5F3FF;
  }
  .blog-inline-cta {
    border: 1px solid #7C3AED;
    border-radius: 12px;
    padding: 32px;
    text-align: center;
    margin-bottom: 48px;
    background: #FFFFFF;
  }
  .blog-inline-cta h2 {
    font-size: 24px;
    font-weight: 800;
    color: #0A0A0A;
    margin: 0 0 12px;
  }
  .blog-inline-cta p {
    font-size: 16px;
    color: #6B7280;
    margin: 0 0 20px;
    line-height: 1.6;
  }
  .blog-inline-cta a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #7C3AED;
    color: white;
    font-weight: 800;
    font-size: 15px;
    padding: 14px 28px;
    border-radius: 10px;
    text-decoration: none;
  }
  .blog-related {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #E5E7EB;
  }
  .blog-related-title {
    font-size: 24px;
    font-weight: 800;
    color: #0A0A0A;
    margin: 0 0 24px;
  }
  @media (max-width: 640px) {
    .blog-article-title {
      font-size: 28px;
    }
    .blog-article-container {
      padding-top: 32px;
    }
  }
`;
