import { ProjectDocEditor } from "@/components/project-doc-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Roadmap — Bookmark Graph" };

export default async function EditRoadmapPage({ searchParams }: PageProps<"/roadmap/edit">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  return <ProjectDocEditor slug="roadmap" error={error} />;
}
