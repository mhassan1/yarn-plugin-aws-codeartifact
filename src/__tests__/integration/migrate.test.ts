import { execSync } from "child_process";
import { join } from "path";
import { copyFileSync, readFileSync } from "fs";

describe("yarn plugin-aws-codeartifact migrate", () => {
  it("should migrate the `yarn.lock` file to use AWS CodeArtifact for relevant packages", () => {
    const cwd = join(__dirname, "fixtures", "test-package-migrate");
    copyFileSync(join(cwd, "yarn.lock.original"), join(cwd, "yarn.lock"));
    const stdout = execSync("yarn plugin-aws-codeartifact migrate", {
      cwd,
    }).toString();
    expect(stdout).toMatch(/2 entries migrated\./);
    expect(readFileSync(join(cwd, "yarn.lock")).toString()).toBe(
      readFileSync(join(cwd, "yarn.lock.expected")).toString()
    );
  });
});
