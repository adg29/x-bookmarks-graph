import { CHANGELOG_SEED, ROADMAP_SEED } from "./project-doc-seeds";
import { read, write } from "./neo4j";

export const PROJECT_DOC_SLUGS = ["roadmap", "changelog"] as const;
export type ProjectDocSlug = (typeof PROJECT_DOC_SLUGS)[number];

export const PROJECT_DOC_TITLES: Record<ProjectDocSlug, string> = {
  roadmap: "Roadmap",
  changelog: "Changelog",
};

export type ProjectDoc = {
  slug: ProjectDocSlug;
  title: string;
  body: string;
  isPublic: boolean;
  updatedAt: string | null;
};

const SEEDS: Record<ProjectDocSlug, string> = {
  roadmap: ROADMAP_SEED,
  changelog: CHANGELOG_SEED,
};

export function isProjectDocSlug(value: string): value is ProjectDocSlug {
  return (PROJECT_DOC_SLUGS as readonly string[]).includes(value);
}

/**
 * Read routes that may skip the login redirect — only the exact doc paths,
 * never `/roadmap/edit` or anything under `/b` / `/api`.
 */
export function publicDocSlugFromPath(pathname: string): ProjectDocSlug | null {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (normalized === "/roadmap" || normalized === "/changelog") {
    return normalized.slice(1) as ProjectDocSlug;
  }
  return null;
}

function toDoc(row: {
  slug: string;
  body: string;
  isPublic: boolean;
  updatedAt: string | null;
}): ProjectDoc | null {
  if (!isProjectDocSlug(row.slug)) return null;
  return {
    slug: row.slug,
    title: PROJECT_DOC_TITLES[row.slug],
    body: row.body ?? "",
    isPublic: Boolean(row.isPublic),
    updatedAt: row.updatedAt,
  };
}

/** Read-only. Missing node or a driver error is treated as private (fail closed). */
export async function isProjectDocPublic(slug: ProjectDocSlug): Promise<boolean> {
  try {
    const result = await read<{ isPublic: boolean | null }>(
      `
      OPTIONAL MATCH (d:ProjectDoc {slug: $slug})
      RETURN d.isPublic AS isPublic
      `,
      { slug },
    );
    return Boolean(result.records[0]?.get("isPublic"));
  } catch {
    return false;
  }
}

export async function getProjectDoc(slug: ProjectDocSlug): Promise<ProjectDoc | null> {
  const result = await read<{
    slug: string;
    body: string;
    isPublic: boolean;
    updatedAt: string | null;
  }>(
    `
    MATCH (d:ProjectDoc {slug: $slug})
    RETURN d.slug AS slug,
           d.body AS body,
           d.isPublic AS isPublic,
           toString(d.updatedAt) AS updatedAt
    `,
    { slug },
  );
  const row = result.records[0]?.toObject();
  return row ? toDoc(row) : null;
}

/**
 * Creates the node with seed copy the first time only. Later edits are never
 * overwritten by a re-run of schema or a later page load.
 */
export async function ensureProjectDocs(): Promise<{ created: ProjectDocSlug[]; existing: ProjectDocSlug[] }> {
  const created: ProjectDocSlug[] = [];
  const existing: ProjectDocSlug[] = [];

  for (const slug of PROJECT_DOC_SLUGS) {
    const result = await write<{ created: boolean }>(
      `
      OPTIONAL MATCH (d:ProjectDoc {slug: $slug})
      WITH d IS NOT NULL AS existed
      MERGE (n:ProjectDoc {slug: $slug})
      ON CREATE SET
        n.body = $body,
        n.isPublic = false,
        n.updatedAt = datetime()
      RETURN NOT existed AS created
      `,
      { slug, body: SEEDS[slug] },
    );

    if (result.records[0]?.get("created")) created.push(slug);
    else existing.push(slug);
  }

  return { created, existing };
}

export async function getOrCreateProjectDoc(slug: ProjectDocSlug): Promise<ProjectDoc> {
  const existing = await getProjectDoc(slug);
  if (existing) return existing;

  await write(
    `
    MERGE (d:ProjectDoc {slug: $slug})
    ON CREATE SET
      d.body = $body,
      d.isPublic = false,
      d.updatedAt = datetime()
    `,
    { slug, body: SEEDS[slug] },
  );

  const created = await getProjectDoc(slug);
  if (!created) throw new Error(`Failed to create ProjectDoc slug=${slug}`);
  return created;
}

export async function updateProjectDoc(
  slug: ProjectDocSlug,
  input: { body: string; isPublic: boolean },
): Promise<ProjectDoc> {
  await getOrCreateProjectDoc(slug);

  const result = await write<{
    slug: string;
    body: string;
    isPublic: boolean;
    updatedAt: string | null;
  }>(
    `
    MATCH (d:ProjectDoc {slug: $slug})
    SET d.body = $body,
        d.isPublic = $isPublic,
        d.updatedAt = datetime()
    RETURN d.slug AS slug,
           d.body AS body,
           d.isPublic AS isPublic,
           toString(d.updatedAt) AS updatedAt
    `,
    { slug, body: input.body, isPublic: input.isPublic },
  );

  const row = result.records[0]?.toObject();
  const doc = row ? toDoc(row) : null;
  if (!doc) throw new Error(`Failed to update ProjectDoc slug=${slug}`);
  return doc;
}

/** Titles only — used on the login page. Never returns body. */
export async function listPublicProjectDocLinks(): Promise<{ slug: ProjectDocSlug; title: string }[]> {
  try {
    const result = await read<{ slug: string }>(
      `
      MATCH (d:ProjectDoc)
      WHERE d.isPublic = true AND d.slug IN $slugs
      RETURN d.slug AS slug
      `,
      { slugs: [...PROJECT_DOC_SLUGS] },
    );

    return result.records
      .map((record) => record.toObject().slug)
      .filter(isProjectDocSlug)
      .map((slug) => ({ slug, title: PROJECT_DOC_TITLES[slug] }));
  } catch {
    return [];
  }
}
