import { Configuration, StreamReport } from "@yarnpkg/core";
import { ppath, PortablePath } from "@yarnpkg/fslib";
import NpmPlugin from "@yarnpkg/plugin-npm";
import { Writable } from "stream";
import { execSync } from "child_process";
import { join } from "path";
import { copyFileSync, readFileSync } from "fs";
import { migrateLockFile } from "../../commands/migrate";

process.env.YARN_RC_FILENAME = ".yarnrc-integration.yml";

describe("migrateLockFile", () => {
  it("should migrate the `yarn.lock` file to use AWS CodeArtifact for relevant packages", async () => {
    const cwd = join(__dirname, "fixtures", "test-package-migrate");
    copyFileSync(join(cwd, "yarn.lock.original"), join(cwd, "yarn.lock"));
    const configuration = await Configuration.find(
      ppath.join(
        __dirname as PortablePath,
        "fixtures" as PortablePath,
        "test-package-migrate" as PortablePath
      ),
      {
        modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
        plugins: new Set([`@yarnpkg/plugin-npm`]),
      }
    );
    let stdout = "";
    const stdoutStream = new Writable({
      write: (chunk, enc, next) => {
        stdout += chunk.toString();
        next();
      },
    });
    await StreamReport.start(
      {
        configuration,
        stdout: stdoutStream,
      },
      async (report) => {
        await migrateLockFile(configuration, report);
      }
    );

    expect(stdout).toMatch(/2 entries migrated\./);
    expect(readFileSync(join(cwd, "yarn.lock")).toString()).toBe(
      readFileSync(join(cwd, "yarn.lock.expected")).toString()
    );
  });
});

describe("yarn plugin-aws-codeartifact migrate", () => {
  it("should migrate the `yarn.lock` file to use AWS CodeArtifact for relevant packages", () => {
    const cwd = join(__dirname, "fixtures", "test-package-migrate");
    copyFileSync(join(cwd, "yarn.lock.original"), join(cwd, "yarn.lock"));
    const stdout = execSync("yarn plugin-aws-codeartifact migrate", {
      cwd,
      env: {
        ...process.env,
        YARN_RC_FILENAME: ".yarnrc.yml",
      },
    }).toString();
    expect(stdout).toMatch(/2 entries migrated\./);
    expect(readFileSync(join(cwd, "yarn.lock")).toString()).toBe(
      readFileSync(join(cwd, "yarn.lock.expected")).toString()
    );
  });
});
