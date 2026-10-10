import { ProjectDocEditor } from "@/components/project-doc-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Changelog — Bookmark Graph" };

export default async function EditChangelogPage({ searchParams }: PageProps<"/changelog/edit">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  return <ProjectDocEditor slug="changelog" error={error} />;
}
