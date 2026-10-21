import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { syncData } from "./sync-data.mjs";
import { readFluSnapshot } from "./validate-flu.mjs";
const { values } = parseArgs({
  options: {
    "backend-root": { type: "string" },
    offline: { type: "boolean", default: false },
  },
});
const root = fileURLToPath(new URL("../", import.meta.url));
const backend = values["backend-root"]
  ? resolve(values["backend-root"])
  : fileURLToPath(new URL("../../Careflow/", import.meta.url));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      "Public flu refresh stopped because a required command failed.",
    );
}
run(
  resolve(backend, ".venv/bin/python"),
  ["-m", "careflow.flu_forecast", ...(values.offline ? [] : ["--download"])],
  backend,
);
await syncData(
  resolve(backend, "data/public/flusight.json"),
  resolve(root, "public/data/flusight.json"),
  readFluSnapshot,
);
run("npm", ["run", "build"], root);
console.log(
  "Refreshed the pinned public flu benchmark. Review before publishing; the source revision and protocol do not advance automatically.",
);
