import Link from "next/link";
import type { BlogPostListItem } from "@/lib/blog-content";
import { formatPostDate } from "@/lib/blog-content";

function CoverImage({ post, className }: { post: BlogPostListItem; className?: string }) {
  if (post.cover_image) {
    return (
      <div className={`blog-card-cover ${className ?? ""}`}>
        <img src={post.cover_image} alt="" />
      </div>
    );
  }

  return (
    <div className={`blog-card-cover blog-card-cover-placeholder ${className ?? ""}`}>
      <div className="blog-card-cover-logo">LT</div>
    </div>
  );
}

function CardBody({ post }: { post: BlogPostListItem }) {
  return (
    <div className="blog-card-body">
      {post.category && <span className="blog-card-category">{post.category}</span>}
      <h2 className="blog-card-title">{post.title}</h2>
      {post.excerpt && <p className="blog-card-excerpt">{post.excerpt}</p>}
      <div className="blog-card-meta">
        <span>{post.author}</span>
        <div className="blog-card-meta-right">
          {post.read_time != null && <span>{post.read_time} min read</span>}
          {post.published_at && <span>{formatPostDate(post.published_at)}</span>}
        </div>
      </div>
    </div>
  );
}

export function BlogPostCard({
  post,
  variant = "default",
}: {
  post: BlogPostListItem;
  variant?: "default" | "featured";
}) {
  if (variant === "featured") {
    return (
      <Link href={`/blog/${post.slug}`} className="blog-post-card blog-post-card-featured">
        <article className="blog-post-card-inner blog-post-card-inner-featured">
          <CoverImage post={post} className="blog-card-cover-featured" />
          <CardBody post={post} />
        </article>
      </Link>
    );
  }

  return (
    <Link href={`/blog/${post.slug}`} className="blog-post-card">
      <article className="blog-post-card-inner">
        <CoverImage post={post} />
        <CardBody post={post} />
      </article>
    </Link>
  );
}

export const blogCardStyles = `
  .blog-post-card {
    display: block;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    height: 100%;
    border-radius: 16px;
    -webkit-tap-highlight-color: transparent;
  }
  .blog-post-card-inner {
    background: #FFFFFF;
    border: 1px solid #E5E7EB;
    border-radius: 16px;
    overflow: hidden;
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, border-left 0.2s ease;
    height: 100%;
    display: flex;
    flex-direction: column;
    border-left: 4px solid transparent;
  }
  .blog-post-card:hover .blog-post-card-inner,
  .blog-post-card:focus-visible .blog-post-card-inner {
    background: #F9FAFB;
    border-color: #E5E7EB;
    border-left-color: #7C3AED;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  }
  .blog-post-card-inner-featured {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 0;
  }
  .blog-card-cover {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #F3F4F6;
  }
  .blog-card-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .blog-card-cover-featured {
    aspect-ratio: auto;
    min-height: 280px;
    height: 100%;
  }
  .blog-card-cover-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(124,58,237,0.08), rgba(167,139,250,0.04));
  }
  .blog-card-cover-logo {
    width: 48px;
    height: 48px;
    background: #7C3AED;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 800;
    color: white;
  }
  .blog-card-body {
    padding: 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .blog-card-category {
    font-size: 11px;
    font-weight: 700;
    color: #7C3AED;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 10px;
    display: block;
  }
  .blog-card-title {
    font-size: 18px;
    font-weight: 800;
    color: #0A0A0A;
    line-height: 1.4;
    margin: 0 0 10px;
    flex: 1;
  }
  .blog-card-excerpt {
    font-size: 14px;
    color: #6B7280;
    line-height: 1.6;
    margin: 0 0 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .blog-card-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: #6B7280;
    flex-wrap: wrap;
  }
  .blog-card-meta-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .blog-post-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  @media (max-width: 1024px) {
    .blog-post-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 768px) {
    .blog-post-card-inner-featured {
      grid-template-columns: 1fr;
    }
    .blog-card-cover-featured {
      min-height: auto;
      aspect-ratio: 16 / 9;
    }
  }
  @media (max-width: 640px) {
    .blog-post-grid {
      grid-template-columns: 1fr;
    }
  }
  .blog-post-card:focus-visible {
    outline: 2px solid rgba(124,58,237,0.5);
    outline-offset: 3px;
  }
`;
