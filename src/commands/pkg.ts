import { Command } from "commander";
import inquirer, { DistinctQuestion } from "inquirer";
import semver from "semver";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const PACKAGES = [
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/server-net",
  "@minecraft/server-admin",
  "@minecraft/vanilla-data",
];

const CATEGORY_ORDER = [
  "release",
  "stable-beta",
  "preview-beta",
  "beta",
  "rc",
  "preview",
  "other-pre",
  "unknown",
];

type VersionCategory = (typeof CATEGORY_ORDER)[number];

function compareSemverDesc(a: string, b: string): number {
  const va = semver.valid(a);
  const vb = semver.valid(b);
  if (va && vb) return semver.rcompare(va, vb);
  if (va) return -1;
  if (vb) return 1;
  return b.localeCompare(a);
}

function categorizeVersion(version: string): VersionCategory {
  const parsed = semver.parse(version);
  if (!parsed) return "unknown";
  if (parsed.prerelease.length === 0) return "release";

  const pre = parsed.prerelease.join(".").toLowerCase();
  if (pre.includes("preview") && pre.includes("beta")) return "preview-beta";
  if (pre.includes("stable") && pre.includes("beta")) return "stable-beta";
  if (pre.includes("beta")) return "beta";
  if (pre.includes("rc")) return "rc";
  if (pre.includes("preview")) return "preview";
  return "other-pre";
}

function inferCategoryFromCurrentVersion(
  current: string | null
): VersionCategory | null {
  if (!current) return null;
  const token = current
    .trim()
    .split(/\s+\|\|\s+|\s+/)[0]
    .replace(/^[=^~><]+/, "");
  if (!token) return null;
  const parsed = semver.parse(token);
  if (!parsed) return null;
  return categorizeVersion(parsed.version);
}

async function fetchPackageVersions(pkgName: string): Promise<string[]> {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${pkgName}: ${response.status} ${response.statusText}`
    );
  }
  const data = (await response.json()) as { versions?: Record<string, unknown> };
  return Object.keys(data.versions ?? {}).sort(compareSemverDesc);
}

async function readPackageJson(cwd: string): Promise<PackageJson> {
  const pkgPath = path.join(cwd, "package.json");
  const raw = await fs.readFile(pkgPath, "utf8");
  return JSON.parse(raw) as PackageJson;
}

function getCurrentVersion(pkgJson: PackageJson, name: string): string | null {
  return pkgJson.dependencies?.[name] ?? pkgJson.devDependencies?.[name] ?? null;
}

async function detectPackageManagers(cwd: string): Promise<PackageManager[]> {
  const checks: Array<{ name: PackageManager; files: string[] }> = [
    { name: "pnpm", files: ["pnpm-lock.yaml"] },
    { name: "npm", files: ["package-lock.json"] },
    { name: "yarn", files: ["yarn.lock"] },
    { name: "bun", files: ["bun.lock", "bun.lockb"] },
  ];

  const matches: PackageManager[] = [];
  await Promise.all(
    checks.map(async (check) => {
      for (const file of check.files) {
        try {
          await fs.access(path.join(cwd, file));
          matches.push(check.name);
          break;
        } catch {
          continue;
        }
      }
    })
  );

  return matches;
}

async function resolvePackageManager(cwd: string): Promise<PackageManager> {
  const matches = await detectPackageManagers(cwd);
  if (matches.length === 1) {
    return matches[0];
  }

  const questions: DistinctQuestion<{ manager: PackageManager }>[] = [
    {
      name: "manager",
      type: "select",
      message: "Select package manager:",
      choices: [
        { name: "pnpm", value: "pnpm" },
        { name: "npm", value: "npm" },
        { name: "yarn", value: "yarn" },
        { name: "bun", value: "bun" },
      ],
    },
  ];

  const { manager } = await inquirer.prompt<{ manager: PackageManager }>(
    questions
  );
  return manager;
}

function buildInstallCommand(
  manager: PackageManager,
  packages: string[]
): { command: string; args: string[] } {
  const baseCommand =
    process.platform === "win32" ? `${manager}.cmd` : manager;
  switch (manager) {
    case "pnpm":
      return { command: baseCommand, args: ["add", ...packages] };
    case "yarn":
      return { command: baseCommand, args: ["add", ...packages] };
    case "bun":
      return { command: baseCommand, args: ["add", ...packages] };
    case "npm":
    default:
      return { command: baseCommand, args: ["install", ...packages] };
  }
}

async function runInstall(
  manager: PackageManager,
  packages: string[]
): Promise<void> {
  if (packages.length === 0) {
    return;
  }

  const { command, args } = buildInstallCommand(manager, packages);

  const spawnCommand =
    process.platform === "win32" ? "cmd.exe" : command;
  const spawnArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", toWindowsCommand([command, ...args])]
      : args;

  await new Promise<void>((resolve, reject) => {
    const child = spawn(spawnCommand, spawnArgs, { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

function toWindowsCommand(parts: string[]): string {
  return parts.map(quoteWindowsArg).join(" ");
}

function quoteWindowsArg(value: string): string {
  if (!/[\s"^&|<>]/.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function groupVersionsByCategory(versions: string[]): Map<VersionCategory, string[]> {
  const grouped = new Map<VersionCategory, string[]>();
  for (const version of versions) {
    const category = categorizeVersion(version);
    const list = grouped.get(category) ?? [];
    list.push(version);
    grouped.set(category, list);
  }
  for (const [category, list] of grouped) {
    grouped.set(category, list.sort(compareSemverDesc));
  }
  return grouped;
}

async function promptForPackage(pkgJson: PackageJson): Promise<string | null> {
  const choices = PACKAGES.map((name) => {
    const current = getCurrentVersion(pkgJson, name);
    const label = current ? `${name} (current: ${current})` : `${name} (current: -)`;
    return { name: label, value: name };
  });

  const questions: DistinctQuestion<{ target: string }>[] = [
    {
      name: "target",
      type: "select",
      message: "Select package:",
      choices,
    },
  ];

  const { target } = await inquirer.prompt<{ target: string }>(questions);
  return target ?? null;
}

async function promptForCategory(
  pkgName: string,
  grouped: Map<VersionCategory, string[]>,
  currentCategory: VersionCategory | null
): Promise<VersionCategory> {
  const choices = CATEGORY_ORDER.filter((category) =>
    (grouped.get(category) ?? []).length
  ).map((category) => {
    const latest = grouped.get(category)?.[0] ?? "-";
    return { name: `${category} (latest: ${latest})`, value: category };
  });

  const defaultValue =
    currentCategory && choices.some((choice) => choice.value === currentCategory)
      ? currentCategory
      : undefined;

  const question: DistinctQuestion<{ category: VersionCategory }> = {
    name: "category",
    type: "select",
    message: `Select release category for ${pkgName}:`,
    choices,
    ...(defaultValue ? { default: defaultValue } : {}),
  };

  const questions: DistinctQuestion<{ category: VersionCategory }>[] = [question];

  const { category } = await inquirer.prompt<{ category: VersionCategory }>(
    questions
  );
  return category;
}

async function promptForVersion(
  pkgName: string,
  versions: string[]
): Promise<string> {
  const questions: DistinctQuestion<{ version: string }>[] = [
    {
      name: "version",
      type: "select",
      message: `Select version for ${pkgName}:`,
      choices: versions.map((version) => ({ name: version, value: version })),
      pageSize: 6,
      loop: false,
    },
  ];

  const { version } = await inquirer.prompt<{ version: string }>(questions);
  return version;
}

export async function runPkgFlow(): Promise<void> {
  const cwd = process.cwd();
  try {
    const pkgJson = await readPackageJson(cwd);
    const manager = await resolvePackageManager(cwd);

    const target = await promptForPackage(pkgJson);
    if (!target) {
      console.log("No package selected.");
      return;
    }

    const currentVersion = getCurrentVersion(pkgJson, target);
    const currentCategory = inferCategoryFromCurrentVersion(currentVersion);
    const versions = await fetchPackageVersions(target);
    const grouped = groupVersionsByCategory(versions);
    const category = await promptForCategory(target, grouped, currentCategory);
    const list = grouped.get(category) ?? [];
    const version = await promptForVersion(target, list);

    await runInstall(manager, [`${target}@${version}`]);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    console.error(err.message ?? String(err));
    process.exitCode = 1;
  }
}

export function registerPkgCommand(program: Command): void {
  program
    .command("pkg")
    .description("Install Minecraft type definition packages")
    .action(runPkgFlow);
}
