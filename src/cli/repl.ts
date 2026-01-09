import * as readline from 'node:readline';
import { TrellisKernel } from '../kernel/trellis-kernel.js';
import chalk from 'chalk';

/**
 * Interactive REPL for Trellis Kernel
 */
export class TQLREPL {
  private rl: readline.Interface;

  constructor(private kernel: TrellisKernel) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('tql> '),
    });
  }

  async start(): Promise<void> {
    console.log(chalk.bold.green('Trellis Kernel REPL v2.0.0'));
    console.log(
      chalk.gray(
        'Type ".help" for a list of commands, or enter an EQL-S query.',
      ),
    );
    console.log(chalk.gray('Press Ctrl+C or type ".exit" to quit.\n'));

    this.rl.prompt();

    this.rl.on('line', async (line) => {
      const input = line.trim();

      if (!input) {
        this.rl.prompt();
        return;
      }

      if (input.startsWith('.')) {
        await this.handleCommand(input);
      } else {
        await this.handleQuery(input);
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });
  }

  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.split(' ');

    switch (cmd) {
      case '.help':
        this.showHelp();
        break;
      case '.exit':
      case '.quit':
        this.rl.close();
        break;
      case '.schema':
        this.showSchema();
        break;
      case '.stats':
        this.showStats();
        break;
      case '.snapshot':
        await this.takeSnapshot();
        break;
      case '.export':
        await this.exportWorkspace(args[0]);
        break;
      case '.clear':
        console.clear();
        break;
      default:
        console.log(
          chalk.red(`Unknown command: ${cmd}. Type ".help" for help.`),
        );
    }
  }

  private async handleQuery(query: string): Promise<void> {
    try {
      const t0 = performance.now();
      const result = await this.kernel.query(query);
      const duration = performance.now() - t0;

      if (result.rows.length === 0) {
        console.log(chalk.yellow('No results found.'));
      } else {
        console.table(result.rows);
        console.log(
          chalk.gray(
            `\n${result.rows.length} rows in ${duration.toFixed(2)}ms`,
          ),
        );
      }

      if (result.plan) {
        console.log(chalk.blue.dim(`Plan: ${result.plan}`));
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  private showHelp(): void {
    console.log(chalk.bold('\nAvailable Commands:'));
    console.log(`  ${chalk.cyan('.help')}          - Show this help message`);
    console.log(
      `  ${chalk.cyan('.schema')}        - Show the data catalog/schema`,
    );
    console.log(
      `  ${chalk.cyan('.stats')}         - Show kernel and store statistics`,
    );
    console.log(
      `  ${chalk.cyan('.snapshot')}      - Trigger a kernel checkpoint (snapshot)`,
    );
    console.log(
      `  ${chalk.cyan('.export [file]')} - Export workspace to a .trellis file`,
    );
    console.log(`  ${chalk.cyan('.clear')}         - Clear the console`);
    console.log(`  ${chalk.cyan('.exit')}          - Exit the REPL\n`);
    console.log(chalk.bold('Querying:'));
    console.log('  Simply enter an EQL-S query like:');
    console.log(
      '  FIND Task AS ?t WHERE ?t.status = "active" RETURN ?t.title\n',
    );
  }

  private showSchema(): void {
    const catalog = this.kernel.getStore().getCatalog();
    if (catalog.length === 0) {
      console.log(chalk.yellow('No schema information available yet.'));
      return;
    }

    console.log(chalk.bold('\nData Catalog:'));
    console.table(
      catalog.map((c) => ({
        Attribute: c.attribute,
        Type: c.type,
        Cardinality: c.cardinality,
        Count: c.distinctCount,
      })),
    );
  }

  private showStats(): void {
    const stats = this.kernel.getStore().getStats();
    console.log(chalk.bold('\nKernel Statistics:'));
    console.log(`  Facts:      ${stats.totalFacts}`);
    console.log(`  Links:      ${stats.totalLinks}`);
    console.log(`  Entities:   ${stats.uniqueEntities}`);
    console.log(`  Attributes: ${stats.uniqueAttributes}`);
  }

  private async takeSnapshot(): Promise<void> {
    try {
      await this.kernel.checkpoint();
      console.log(chalk.green('Snapshot saved successfully.'));
    } catch (error) {
      console.error(
        chalk.red(
          `Failed to save snapshot: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }

  private async exportWorkspace(filename?: string): Promise<void> {
    try {
      const config = await this.kernel.exportWorkspace();
      const output = JSON.stringify(config, null, 2);

      if (filename) {
        const fs = await import('node:fs/promises');
        await fs.writeFile(filename, output);
        console.log(chalk.green(`Workspace exported to ${filename}`));
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(
        chalk.red(
          `Failed to export workspace: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  }
}
