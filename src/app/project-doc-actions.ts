"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isProjectDocSlug, updateProjectDoc, type ProjectDocSlug } from "@/lib/project-docs";
import { isSignedIn } from "@/lib/session";

const MAX_BODY = 100_000;

export async function saveProjectDoc(slug: ProjectDocSlug, formData: FormData) {
  if (!isProjectDocSlug(slug)) {
    redirect("/");
  }

  if (!(await isSignedIn())) {
    redirect(`/login?next=/${slug}/edit`);
  }

  const body = String(formData.get("body") ?? "");
  if (body.length > MAX_BODY) {
    redirect(`/${slug}/edit?error=too-large`);
  }

  const isPublic = formData.get("isPublic") === "on";
  await updateProjectDoc(slug, { body, isPublic });

  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/edit`);
  revalidatePath("/login");

  redirect(`/${slug}?saved=1`);
}
