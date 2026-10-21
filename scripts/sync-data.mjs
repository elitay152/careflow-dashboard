import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSnapshot } from "./validate-data.mjs";

export async function syncData(source, destination) {
  // Publish the exact bytes that were validated, not a second read of source.
  const bytes = await readSnapshot(source);
  const target =
    destination instanceof URL ? fileURLToPath(destination) : destination;
  await mkdir(dirname(target), { recursive: true });
  const temporary = await mkdtemp(join(dirname(target), ".snapshot-"));
  try {
    const staged = join(temporary, "careflow.json");
    await writeFile(staged, bytes, { mode: 0o600, flag: "wx" });
    await rename(staged, target);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await syncData(
    process.argv[2] ||
      new URL("../../Careflow/data/public/careflow.json", import.meta.url),
    new URL("../public/data/careflow.json", import.meta.url),
  );
  console.log(
    "Copied validated aggregate bytes atomically. Rebuild to update the bundled snapshot.",
  );
}
