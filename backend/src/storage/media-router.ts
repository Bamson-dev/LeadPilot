import { Router, type Request, type Response } from "express";
import path from "path";
import { createReadStream, existsSync } from "fs";
import { getBlogCoversDir } from "./blog-cover-storage";

export const mediaRouter = Router();

const ALLOWED = /^[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/i;

mediaRouter.get("/blog-covers/:filename", (req: Request, res: Response) => {
  const filename = path.basename(String(req.params.filename || ""));
  if (!ALLOWED.test(filename)) {
    res.status(400).json({ error: "invalid_filename" });
    return;
  }

  const root = path.resolve(getBlogCoversDir());
  const filePath = path.resolve(root, filename);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    res.status(400).json({ error: "invalid_path" });
    return;
  }
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "not_found" });
    return;
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  createReadStream(filePath).pipe(res);
});
