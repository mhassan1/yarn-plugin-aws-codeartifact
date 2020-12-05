import {
  Plugin,
  Configuration,
  CommandContext,
  StreamReport,
} from "@yarnpkg/core";
import "./authHook";
import { migrateLockFile } from "./migrate";
import { Command } from "clipanion";
import { version } from "../package.json";

/**
 * Command to provide the version of this plugin
 */
class VersionCommand extends Command<CommandContext> {
  @Command.Path("plugin-aws-codeartifact", "version")
  async execute() {
    this.context.stdout.write(`${version}\n`);
  }
}

/**
 * Command to migrate a `yarn.lock` file to use the AWS CodeArtifact repository for all packages
 */
// tslint:disable-next-line:max-classes-per-file
class MigrateCommand extends Command<CommandContext> {
  @Command.Path("plugin-aws-codeartifact", "migrate")
  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins
    );
    const streamReport = await StreamReport.start(
      {
        configuration,
        stdout: this.context.stdout,
      },
      async (report) => {
        await migrateLockFile({ configuration, report });
      }
    );

    return streamReport.exitCode();
  }
}

const plugin: Plugin = {
  commands: [VersionCommand, MigrateCommand],
};
export default plugin;
