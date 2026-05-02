#!/usr/bin/env node
import { Command } from 'commander';
import inquirer, { DistinctQuestion } from 'inquirer';
import { registerLinkCommand, runLinkFlow } from './commands/link';
import { registerPkgCommand, runPkgFlow } from './commands/pkg';
import pkg from '../package.json' with { type: 'json' };

const program = new Command();

process.on('SIGINT', () => {
  process.stdout.write('\n');
  process.exit(0);
});

program
  .name('mcutil')
  .description('Minecraft Bedrock development support CLI')
  .version(pkg.version ?? '0.0.0');

registerLinkCommand(program);
registerPkgCommand(program);

program.action(async () => {
  type MenuAnswers = {
    feature: 'link' | 'pkg';
  };

  const questions: DistinctQuestion<MenuAnswers>[] = [
    {
      name: 'feature',
      type: 'select',
      message: 'Select a core feature:',
      choices: [
        { name: 'pkg', value: 'pkg' },
        { name: 'link', value: 'link' },
      ],
    },
  ];

  const { feature } = await inquirer.prompt<MenuAnswers>(questions).catch((error) => {
    if (error.name === 'ExitPromptError') {
      process.exit(0);
    }

    console.error(error);
    process.exit(1);
  });

  if (feature === 'link') {
    await runLinkFlow();
  }
  if (feature === 'pkg') {
    await runPkgFlow();
  }
});

program.parse(process.argv);
