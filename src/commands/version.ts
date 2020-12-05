import { CommandContext } from "@yarnpkg/core";
import { Command } from "clipanion";
import { version } from "../../package.json";

/**
 * Command to provide the version of this plugin
 */
export class VersionCommand extends Command<CommandContext> {
  @Command.Path("plugin-aws-codeartifact", "version")
  async execute() {
    this.context.stdout.write(`${version}\n`);
  }
}
