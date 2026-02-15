import { Command } from "commander";
import inquirer, { DistinctQuestion } from "inquirer";
import semver from "semver";
import fs from "node:fs/promises";
import path from "node:path";
import { installPackage } from "@antfu/install-pkg";

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

interface PackageInfo {
  name: string;
  dev: boolean;
}

const PACKAGES = [
  {
    name: "@minecraft/server",
    dev: true,
  },
  {
    name: "@minecraft/server-ui",
    dev: true,
  },
  {
    name: "@minecraft/server-net",
    dev: true,
  },
  {
    name: "@minecraft/server-admin",
    dev: true,
  },
  {
    name: "@minecraft/diagnostics",
    dev: true,
  },
  {
    name: "@minecraft/vanilla-data",
    dev: false,
  },
  {
    name: "@minecraft/server-gametest",
    dev: true,
  },
] as const satisfies PackageInfo[];

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

async function promptForPackage(pkgJson: PackageJson): Promise<PackageInfo | null> {
  const choices = PACKAGES.map((pkg) => {
    const current = getCurrentVersion(pkgJson, pkg.name);
    const label = current ? `${pkg.name} (current: ${current})` : `${pkg.name} (current: -)`;
    return { name: label, value: pkg };
  });

  const questions: DistinctQuestion<{ target: PackageInfo }>[] = [
    {
      name: "target",
      type: "select",
      message: "Select package:",
      choices,
    },
  ];

  const { target } = await inquirer.prompt<{ target: PackageInfo }>(questions);
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

    const target = await promptForPackage(pkgJson);
    if (!target) {
      console.log("No package selected.");
      return;
    }

    const currentVersion = getCurrentVersion(pkgJson, target.name);
    const currentCategory = inferCategoryFromCurrentVersion(currentVersion);
    const versions = await fetchPackageVersions(target.name);
    const grouped = groupVersionsByCategory(versions);
    const category = await promptForCategory(target.name, grouped, currentCategory);
    const list = grouped.get(category) ?? [];
    const version = await promptForVersion(target.name, list);

    await installPackage(target.name, { silent: false, cwd, dev: target.dev });

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
