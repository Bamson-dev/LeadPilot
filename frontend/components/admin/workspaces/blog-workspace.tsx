"use client";

import { BlogManager } from "@/components/admin/blog-manager";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";

export function BlogWorkspace() {
  return (
    <>
      <AdminWorkspaceHeader
        title="Blog"
        description="Write and publish articles to leadthur.com/blog."
      />
      <BlogManager />
    </>
  );
}
