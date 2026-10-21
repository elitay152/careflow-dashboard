import { syncData } from "./sync-data.mjs";
import { readFluSnapshot } from "./validate-flu.mjs";

await syncData(
  process.argv[2] ||
    new URL("../../Careflow/data/public/flusight.json", import.meta.url),
  new URL("../public/data/flusight.json", import.meta.url),
  readFluSnapshot,
);
console.log("Copied verified public flu evidence atomically.");
