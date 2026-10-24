import { fileURLToPath } from "node:url";
import { syncData } from "./sync-data.mjs";
import { readReadmission } from "./validate-readmission.mjs";
export async function syncReadmission(
  source,
  destination = new URL("../public/data/readmission.json", import.meta.url),
) {
  return syncData(source, destination, async (path) => {
    const bytes = await readReadmission(path);
    if (JSON.parse(bytes.toString("utf8")).status !== "completed")
      throw new Error(
        "A deployment refresh requires completed UCI evidence; pending results cannot replace it.",
      );
    return bytes;
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await syncReadmission(
    process.argv[2] ||
      new URL("../../Careflow/data/public/readmission.json", import.meta.url),
  );
  console.log("Copied completed readmission aggregates atomically.");
}
