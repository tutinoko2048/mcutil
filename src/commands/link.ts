import { Command } from "commander";
import inquirer, { DistinctQuestion } from "inquirer";
import fs from "node:fs/promises";
import path from "node:path";

type LinkTarget = "release" | "preview" | "custom";

interface LinkAnswers {
  folderName: string;
  target: LinkTarget;
  customPath?: string;
}

function getAppData(): string {
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error("APPDATA is not set.");
  }
  return appData;
}

function getDefaultFolderName(cwd: string): string {
  return path.basename(cwd) || path.basename(path.dirname(cwd));
}

function getTargetBase(target: LinkTarget, customPath?: string): string {
  if (target === "custom") {
    if (!customPath || !customPath.trim()) {
      throw new Error("Custom path is required.");
    }
    return customPath.trim();
  }

  const appData = getAppData();
  const baseFolder =
    target === "release" ? "Minecraft Bedrock" : "Minecraft Bedrock Preview";

  return path.join(
    appData,
    baseFolder,
    "Users",
    "Shared",
    "games",
    "com.mojang",
    "development_behavior_packs"
  );
}

async function ensureLinkDoesNotExist(linkPath: string): Promise<void> {
  try {
    await fs.lstat(linkPath);
    throw new Error(`Target already exists: ${linkPath}`);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
}

async function createSymlink(targetDir: string, linkPath: string): Promise<void> {
  await fs.mkdir(path.dirname(linkPath), { recursive: true });
  await ensureLinkDoesNotExist(linkPath);
  await fs.symlink(targetDir, linkPath, "dir");
}

function formatPermissionError(error: NodeJS.ErrnoException): string | null {
  if (error.code === "EPERM" || error.code === "EACCES") {
    return "Permission denied. Please run this command as Administrator.";
  }
  return null;
}

export async function runLinkFlow(): Promise<void> {
  const cwd = process.cwd();
  try {
    const questions: DistinctQuestion<LinkAnswers>[] = [
      {
        name: "folderName",
        type: "input",
        message: "Link folder name:",
        default: getDefaultFolderName(cwd),
        validate: (input: string) =>
          input.trim().length > 0 || "Folder name is required.",
      },
      {
        name: "target",
        type: "select",
        message: "Target location:",
        choices: [
          { name: "release", value: "release" },
          { name: "preview", value: "preview" },
          { name: "custom", value: "custom" },
        ],
      },
      {
        name: "customPath",
        type: "input",
        message: "Custom path:",
        when: (current: Partial<LinkAnswers>) => current.target === "custom",
        validate: (input: string) =>
          input.trim().length > 0 || "Custom path is required.",
      },
    ];
    const answers = await inquirer.prompt<LinkAnswers>(questions);

    const targetBase = getTargetBase(answers.target, answers.customPath);
    const linkPath = path.join(targetBase, answers.folderName);

    await createSymlink(cwd, linkPath);
    console.log(`Created symlink: ${linkPath} -> ${cwd}`);
  } catch (error: any) {
    if (error.name === "ExitPromptError") {
      console.log("Linking cancelled.");
      process.exit(0);
    }

    console.error(error);
    process.exit(1);
  }
}

export function registerLinkCommand(program: Command): void {
  program
    .command("link")
    .description(
      "Link the current folder to the Minecraft Bedrock development_behavior_packs folder"
    )
    .action(runLinkFlow);
}
