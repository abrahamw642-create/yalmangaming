import type { Metadata } from "next";

import { CategoryManager } from "@/components/admin/CategoryManager";
import { Note, PageHeader } from "@/components/admin/ui";
import { listAdminCategories } from "@/lib/admin-queries";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await listAdminCategories();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Catalogue"
        title="Categories"
        description="The browse tree behind /shop, the mega menu and every breadcrumb. Roots first, each followed by its children."
      />

      <Note tone="info">
        A category can select products two ways at once: anything assigned to it by{" "}
        <code className="font-mono text-cyan">categoryId</code>, plus anything whose
        component kind matches the <strong>kind</strong> the category declares. That
        is why the seeded catalogue lists correctly even where a product carries no
        category of its own.
      </Note>

      <CategoryManager categories={categories} />
    </div>
  );
}
