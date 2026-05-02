import { Command } from "commander";
import inquirer, { DistinctQuestion } from "inquirer";
import fs from "node:fs/promises";
import path from "node:path";
import { installPackage } from "@antfu/install-pkg";
import { compareVersion, fetchPackageVersions } from './sort';
import { categorizeVersion, PackageInfo, PACKAGES } from './packages';
import { group } from 'node:console';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function readPackageJson(cwd: string): Promise<PackageJson> {
  const pkgPath = path.join(cwd, "package.json");
  const raw = await fs.readFile(pkgPath, "utf8");
  return JSON.parse(raw) as PackageJson;
}

function getCurrentVersion(pkgJson: PackageJson, name: string): string | null {
  return pkgJson.dependencies?.[name] ?? pkgJson.devDependencies?.[name] ?? null;
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

async function promptForCategory<T extends Record<string, string[]>>(
  pkg: PackageInfo,
  grouped: T,
  currentCategory?: keyof T
): Promise<keyof T> {
  const choices = pkg.categories.filter(c => grouped[c]?.length).map((category) => {
    const latest = grouped[category as keyof T]?.[0] ?? "-";
    return { name: `${category} (latest: ${latest})`, value: category };
  });

  const defaultValue =
    currentCategory && choices.some((choice) => choice.value === currentCategory)
      ? currentCategory
      : undefined;

  const question: DistinctQuestion<{ category: keyof T }> = {
    name: "category",
    type: "select",
    message: `Select release category for ${pkg.name}:`,
    choices,
    ...(defaultValue ? { default: defaultValue } : {}),
  };

  const questions: DistinctQuestion<{ category: keyof T }>[] = [question];

  const { category } = await inquirer.prompt<{ category: keyof T }>(
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

    const pkgInfo = PACKAGES.find((p) => p.name === target.name);
    if (!pkgInfo) throw new Error(`Package info not found for ${target.name}`);

    const currentVersion = getCurrentVersion(pkgJson, target.name);
    const currentCategory = currentVersion
      ? (pkgInfo.categorize?.(currentVersion) ?? categorizeVersion(currentVersion))
      : undefined;

    let versions = await fetchPackageVersions(target.name);
    if (target.exclude) {
      versions = versions.filter((v) => !target.exclude!(v));
    }

    const grouped = Object.groupBy(versions, pkgInfo.categorize ?? categorizeVersion);
    for (const group of Object.values(grouped)) {
      group.sort(compareVersion).reverse();
    }

    const category = await promptForCategory(target, grouped, currentCategory);
    const selectedGroup = grouped[category] ?? [];
    const selectedVersion = await promptForVersion(target.name, selectedGroup);

    await installPackage(
      `${target.name}@${selectedVersion}`,
      { silent: false, cwd, dev: target.dev, additionalArgs: ['-E'] }
    );

  } catch (error: any) {
    if (error.name === "ExitPromptError") {
      console.log("Installation cancelled.");
      process.exit(0);
    }

    console.error(error);
    process.exit(1);
  }
}

export function registerPkgCommand(program: Command): void {
  program
    .command("pkg")
    .description("Install Minecraft type definition packages")
    .action(runPkgFlow);
}
