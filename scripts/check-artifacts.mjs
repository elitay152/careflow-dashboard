import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readSnapshot } from "./validate-data.mjs";
import { readFluSnapshot } from "./validate-flu.mjs";

async function walk(root, prefix = "") {
  const files = [];
  for (const name of await readdir(join(root, prefix))) {
    const relative = prefix ? `${prefix}/${name}` : name;
    const info = await lstat(join(root, relative));
    if (info.isSymbolicLink())
      throw new Error(`Symlink not permitted in public artifacts: ${relative}`);
    if (info.isDirectory()) {
      if (!["data", "assets"].includes(relative))
        throw new Error(`Unexpected public directory: ${relative}`);
      files.push(...(await walk(root, relative)));
    } else if (info.isFile()) files.push(relative);
    else throw new Error(`Non-file public artifact: ${relative}`);
  }
  return files;
}
export async function checkArtifacts(root, stage) {
  if (!["public", "dist"].includes(stage))
    throw new Error("Unknown artifact stage");
  const files = await walk(root);
  const required = [
    "favicon.svg",
    "data/careflow.json",
    "data/flusight.json",
    ...(stage === "dist" ? ["index.html"] : []),
  ];
  for (const file of files) {
    if (
      !required.includes(file) &&
      !(stage === "dist" && /^assets\/[A-Za-z0-9_-]+\.(?:js|css)$/u.test(file))
    ) {
      throw new Error(`Unexpected public artifact: ${file}`);
    }
  }
  if (required.some((file) => !files.includes(file)))
    throw new Error("Missing required public artifact");
  if (stage === "dist" && !files.some((file) => file.endsWith(".js")))
    throw new Error("Missing built JavaScript");
  return files;
}
export async function checkRelease(root) {
  await checkArtifacts(join(root, "public"), "public");
  await checkArtifacts(join(root, "dist"), "dist");
  for (const [name, read] of [
    ["careflow", readSnapshot],
    ["flusight", readFluSnapshot],
  ]) {
    const source = await read(join(root, `public/data/${name}.json`));
    const built = await readFile(join(root, `dist/data/${name}.json`));
    if (!source.equals(built))
      throw new Error("Built snapshot differs from validated public snapshot");
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  if (process.argv[2] === "--public")
    await checkArtifacts(join(root, "public"), "public");
  else await checkRelease(root);
  console.log("Public artifact allowlist verified.");
}
