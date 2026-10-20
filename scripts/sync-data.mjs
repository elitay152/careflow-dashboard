import { copyFile, readFile, mkdir } from "node:fs/promises";
import { validateData } from "./validate-data.mjs";

const source =
  process.argv[2] ||
  new URL("../../Careflow/data/public/careflow.json", import.meta.url);
const destination = new URL("../public/data/careflow.json", import.meta.url);
validateData(JSON.parse(await readFile(source, "utf8")));
await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await copyFile(source, destination);
console.log(
  "Copied the reviewed aggregate export. Rebuild to update the bundled snapshot.",
);
