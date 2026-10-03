/**
 * The app is useless without the graph, so a connection failure explains itself and
 * names the two documented paths rather than showing a stack trace.
 */
export function GraphUnreachable({ error }: { error: string }) {
  return (
    <div className="border-destructive/40 bg-destructive/5 rounded-lg border p-6">
      <h2 className="font-heading text-base font-semibold">Can&apos;t reach Neo4j</h2>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        The explorer reads everything from the graph, so nothing renders until the driver
        connects.
      </p>
      <pre className="bg-muted/60 mt-4 overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed">
        {error}
      </pre>
      <div className="text-muted-foreground mt-4 space-y-2 text-sm leading-relaxed">
        <p>Check in this order:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <code className="font-mono">.env.local</code> exists with{" "}
            <code className="font-mono">NEO4J_URI</code>,{" "}
            <code className="font-mono">NEO4J_USER</code>, and{" "}
            <code className="font-mono">NEO4J_PASSWORD</code>.
          </li>
          <li>
            The database is running — <code className="font-mono">npm run neo4j:up</code> for the
            local container, or your Aura instance is resumed (free instances auto-pause).
          </li>
          <li>
            The schema is applied — <code className="font-mono">npm run schema</code>.
          </li>
        </ol>
      </div>
    </div>
  );
}
