import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

async function resolveTag(slug: string): Promise<string | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    const res = await fetch(`${apiUrl}/public/blog/posts?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const posts = (data.posts || []) as Array<{ tags?: string[] }>;
    const allTags = new Set<string>();
    posts.forEach((post) => {
      post.tags?.forEach((tag) => allTags.add(tag));
    });
    for (const tag of allTags) {
      if (tag.toLowerCase().replace(/[^a-z0-9]+/g, "-") === slug) {
        return tag;
      }
    }
    return null;
  } catch {
    return null;
  }
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tag = await resolveTag(slug);

  if (!tag) {
    return { title: "Tag Not Found | LeadThur Blog" };
  }

  return {
    title: `${tag} — LeadThur Blog`,
    description: `Articles tagged "${tag}" on the LeadThur blog.`,
    alternates: {
      canonical: `https://www.leadthur.com/blog/tag/${slug}`,
    },
    openGraph: {
      title: `${tag} — LeadThur Blog`,
      description: `Lead generation and business growth articles tagged ${tag}.`,
      url: `https://www.leadthur.com/blog/tag/${slug}`,
      siteName: "LeadThur",
      images: [{ url: "https://www.leadthur.com/og-image.png", width: 1200, height: 630 }],
      type: "website",
    },
  };
}

export default async function BlogTagPage({ params }: Props) {
  const { slug } = await params;
  const tag = await resolveTag(slug);

  if (!tag) {
    notFound();
  }

  redirect(`/blog?tag=${encodeURIComponent(tag)}`);
}
