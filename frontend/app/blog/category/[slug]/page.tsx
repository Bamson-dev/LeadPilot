import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { slugToCategory } from "@/lib/blog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = slugToCategory(slug);

  if (!category) {
    return { title: "Category Not Found | LeadThur Blog" };
  }

  return {
    title: `${category} — LeadThur Blog`,
    description: `Articles about ${category.toLowerCase()} for freelancers, agency owners, and consultants.`,
    alternates: {
      canonical: `https://www.leadthur.com/blog/category/${slug}`,
    },
    openGraph: {
      title: `${category} — LeadThur Blog`,
      description: `Practical ${category.toLowerCase()} guides from LeadThur.`,
      url: `https://www.leadthur.com/blog/category/${slug}`,
      siteName: "LeadThur",
      images: [{ url: "https://www.leadthur.com/og-image.png", width: 1200, height: 630 }],
      type: "website",
    },
  };
}

export default async function BlogCategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = slugToCategory(slug);

  if (!category) {
    notFound();
  }

  redirect(`/blog?category=${encodeURIComponent(category)}`);
}
