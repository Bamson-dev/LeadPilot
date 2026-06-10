import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/activate", "/dashboard", "/demo"],
      },
    ],
    sitemap: "https://www.leadthur.com/sitemap.xml",
  };
}
