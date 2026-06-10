import { Router, type Request, type Response } from "express";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";

const router = Router();

// PUBLIC — no auth required
// Used by layout.tsx to fetch sitewide scripts for injection
router.get("/site-scripts", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("id, value")
      .in("id", ["head_scripts", "body_scripts"]);

    if (error) throw error;

    const settings: Record<string, string> = {};
    data?.forEach((row) => {
      settings[row.id as string] = row.value as string;
    });

    res.json({
      headScripts: settings["head_scripts"] || "",
      bodyScripts: settings["body_scripts"] || "",
    });
  } catch (err) {
    logger.error("Failed to fetch public site scripts", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ headScripts: "", bodyScripts: "" });
  }
});

router.get("/blog/posts", async (req: Request, res: Response) => {
  try {
    const { category, tag, limit = "12", offset = "0", featured } = req.query;

    let query = supabase
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, cover_image, author, author_title, category, tags, read_time, published_at, featured, updated_at"
      )
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (category) query = query.eq("category", category);
    if (tag) query = query.contains("tags", [tag]);
    if (featured === "true") query = query.eq("featured", true);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ posts: data || [] });
  } catch (err) {
    logger.error("Failed to fetch public blog posts", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ posts: [] });
  }
});

router.get("/blog/posts/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(data);
  } catch (err) {
    logger.error("Failed to fetch public blog post", {
      error: err instanceof Error ? err.message : "unknown",
      slug: req.params.slug,
    });
    res.status(500).json({ error: "Post not found" });
  }
});

router.get("/blog/categories", async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("blog_posts")
      .select("category")
      .eq("status", "published")
      .not("category", "is", null);

    if (error) throw error;

    const counts: Record<string, number> = {};
    data?.forEach((post) => {
      if (post.category) {
        counts[post.category as string] = (counts[post.category as string] || 0) + 1;
      }
    });

    const categories = Object.entries(counts).map(([name, count]) => ({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      count,
    }));

    res.json({ categories });
  } catch (err) {
    logger.error("Failed to fetch blog categories", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ categories: [] });
  }
});

export default router;
