import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import * as schema from "./schema";

const dataDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.WRITEFLOW_DATA_DIR ?? "data");
const dbPath = path.join(dataDir, "writeflow.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export { schema };
