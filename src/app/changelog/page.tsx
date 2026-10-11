import { ProjectDocView } from "@/components/project-doc-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Changelog — Bookmark Graph" };

export default async function ChangelogPage({ searchParams }: PageProps<"/changelog">) {
  const params = await searchParams;
  return <ProjectDocView slug="changelog" saved={params.saved === "1"} />;
}
