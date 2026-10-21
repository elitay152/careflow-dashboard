import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { syncData } from "./sync-data.mjs";

const { values } = parseArgs({
  options: {
    "confirm-synthetic": { type: "boolean", default: false },
    "backend-root": { type: "string" },
    "raw-schema": { type: "string", default: "synthea_p1000_seed43" },
    "analytics-schema": { type: "string", default: "synthea_p1000_seed43_analytics" },
    label: { type: "string", default: "Synthea 3.3.0 · seed 43 · 1,000 living-patient target" },
  },
});
if (!values["confirm-synthetic"])
  throw new Error("Pass --confirm-synthetic after checking that the source contains only synthetic data.");
const root = fileURLToPath(new URL("../", import.meta.url));
const backend = values["backend-root"]
  ? resolve(values["backend-root"])
  : fileURLToPath(new URL("../../Careflow/", import.meta.url));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Refresh stopped because a required command failed.");
}
run("bash", ["scripts/refresh_public.sh", "--confirm-synthetic",
  values["raw-schema"], values["analytics-schema"], values.label], backend);
await syncData(resolve(backend, "data/public/careflow.json"), resolve(root, "public/data/careflow.json"));
run("npm", ["run", "build"], root);
console.log("Refreshed and built the website from PostgreSQL aggregates. Review the snapshot diff; publish through the website's normal main-branch deployment.");
