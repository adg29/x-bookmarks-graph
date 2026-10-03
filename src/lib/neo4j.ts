import neo4j, { type Driver, type EagerResult, type RecordShape } from "neo4j-driver";

import { neo4jConfig } from "./env";

declare global {
  // Reused across hot reloads so dev does not leak connection pools.
  var __bkgDriver: Driver | undefined;
}

export function getDriver(): Driver {
  if (globalThis.__bkgDriver) return globalThis.__bkgDriver;

  const { uri, user, password } = neo4jConfig();
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    disableLosslessIntegers: true,
  });

  globalThis.__bkgDriver = driver;
  return driver;
}

export async function read<T extends RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<EagerResult<T>> {
  const { database } = neo4jConfig();
  return getDriver().executeQuery<EagerResult<T>>(cypher, params, {
    database,
    routing: neo4j.routing.READ,
  });
}

export async function write<T extends RecordShape>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<EagerResult<T>> {
  const { database } = neo4jConfig();
  return getDriver().executeQuery<EagerResult<T>>(cypher, params, {
    database,
    routing: neo4j.routing.WRITE,
  });
}

/** Runs `work` inside one write transaction, so a multi-statement upsert is all-or-nothing. */
export async function writeTx<T>(
  work: (run: <R extends RecordShape>(cypher: string, params?: Record<string, unknown>) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  const { database } = neo4jConfig();
  const session = getDriver().session({ database, defaultAccessMode: neo4j.session.WRITE });
  try {
    return await session.executeWrite(async (tx) => {
      return work(async <R extends RecordShape>(cypher: string, params: Record<string, unknown> = {}) => {
        const result = await tx.run<R>(cypher, params);
        return result.records.map((record) => record.toObject() as R);
      });
    });
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (!globalThis.__bkgDriver) return;
  await globalThis.__bkgDriver.close();
  globalThis.__bkgDriver = undefined;
}

export async function verifyConnectivity(): Promise<void> {
  const { database } = neo4jConfig();
  await getDriver().verifyConnectivity({ database });
}
