const DEV_ACCESS_SECRET = "dev-local-access";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function neo4jConfig() {
  return {
    uri: process.env.NEO4J_URI ?? "bolt://localhost:7687",
    user: process.env.NEO4J_USER ?? "neo4j",
    password: required("NEO4J_PASSWORD"),
    database: process.env.NEO4J_DATABASE ?? "neo4j",
  };
}

/**
 * The explorer gate secret. In production an unset secret locks the app rather than
 * opening it; locally it falls back to a well-known value so `npm run dev` just works.
 */
export function accessSecret(): string | null {
  const value = process.env.APP_ACCESS_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") return null;
  return DEV_ACCESS_SECRET;
}

export function ingestToken(): string {
  return required("INGEST_TOKEN");
}
