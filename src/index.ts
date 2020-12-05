import { Plugin } from "@yarnpkg/core";
import "./authHook";
import { VersionCommand } from "./commands/version";
import { MigrateCommand } from "./commands/migrate";

const plugin: Plugin = {
  commands: [VersionCommand, MigrateCommand],
};
export default plugin;
