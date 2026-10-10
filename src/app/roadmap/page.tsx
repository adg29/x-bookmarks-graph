import { ProjectDocView } from "@/components/project-doc-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roadmap — Bookmark Graph" };

export default async function RoadmapPage({ searchParams }: PageProps<"/roadmap">) {
  const params = await searchParams;
  return <ProjectDocView slug="roadmap" saved={params.saved === "1"} />;
}
