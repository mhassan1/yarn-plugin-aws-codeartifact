# Changelog

## [0.19.0] - 2024-04-22
[0.19.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.18.0...v0.19.0

- Added: Add support for `skipCommand`

## [0.18.0] - 2024-01-17
[0.18.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.17.0...v0.18.0

- Bump `@aws-sdk/*` dependencies

## [0.17.0] - 2023-10-23
[0.17.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.16.1...v0.17.0

- BREAKING: Upgrade to Yarn 4

## [0.16.1] - 2023-09-14
[0.16.1]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.16.0...v0.16.1

- Return dummy header in Dependabot

## [0.16.0] - 2023-07-18
[0.16.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.15.0...v0.16.0

- Skip authentication in Dependabot

## [0.15.0] - 2023-07-05
[0.15.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.14.0...v0.15.0

- Bump dependencies

## [0.14.0] - 2023-06-06
[0.14.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.13.0...v0.14.0

- Bump `@aws-sdk/*` dependencies

## [0.13.0] - 2023-04-21
[0.13.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.12.0...v0.13.0

- Removed: Remove unnecessary `migrate` command
  - This is no longer needed ([link](https://github.com/yarnpkg/berry/issues/4910#issuecomment-1517299716))

## [0.12.0] - 2022-12-20
[0.12.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.11.0...v0.12.0

- Bump `@aws-sdk/*` dependencies

## [0.11.0] - 2022-12-16
[0.11.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.10.1...v0.11.0

- Added: Add support for Web Identity Tokens

## [0.10.1] - 2022-07-20
[0.10.1]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.10.0...v0.10.1

- Fixed: Don't require plugin config to be provided

## [0.10.0] - 2022-05-27
[0.10.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.9.2...v0.10.0

- Added: Add support for `preAuthCommand`

## [0.9.2] - 2022-02-10
[0.9.2]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.9.1...v0.9.2

- Bump vulnerable dependencies

## [0.9.1] - 2022-02-10
[0.9.1]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.9.0...v0.9.1

- Fixed: Detect `yarn dlx` commands more robustly

## [0.9.0] - 2021-12-17
[0.9.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.8.0...v0.9.0

- BREAKING: Switch to the `getNpmAuthenticationHeader` hook
  - `npmAlwaysAuth: true` must be specified in `.yarnrc.yml` from now on

## [0.8.0] - 2021-08-03
[0.8.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.7.6...v0.8.0

- BREAKING: Upgrade to Yarn 3

## [0.7.6] - 2021-04-20
[0.7.6]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.7.5...v0.7.6

- Added: Add `yarn workspaces focus` to list of registry commands

## [0.7.5] - 2021-03-12
[0.7.5]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.7.4...v0.7.5

- Added: Add `yarn pack --install-if-needed` to list of registry commands

## [0.7.4] - 2021-01-20
[0.7.4]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.7.3...v0.7.4

- Fixed: Start in working directory when searching for plugin config files on `yarn dlx`

## [0.7.3] - 2021-01-11
[0.7.3]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.7.2...v0.7.3

- Fixed: Correct minimum `yarn` version to resolve `parseOptionalBoolean` error

## [0.7.2] - 2020-12-30
[0.7.2]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.7.1...v0.7.2

- Fixed: Cache yarn cache in travis-ci

## [0.7.1] - 2020-12-30
[0.7.1]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.7.0...v0.7.1

- Fixed: Upgrade yarn for `fs` support of `BigInt` (https://github.com/yarnpkg/berry/issues/2232)
- Fixed: Use local home directory in automated tests

## [0.7.0] - 2020-12-29
[0.7.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.6.1...v0.7.0

- Fixed: Prettier formatting
- Added: yarn prettier-check command
- Fixed: VS Code integration
- Fixed: typescript issue - added validation for AWS CA auth token

## [0.6.1] - 2020-12-28
[0.6.1]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.6.0...v0.6.1

- Use `miscUtils.parseOptionalBoolean` for optional `preferAwsEnvironmentCredentials`

## [0.6.0] - 2020-12-28
[0.6.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.5.0...v0.6.0

- Ignore plugin configuration files outside this project during automated tests
- Add support for `preferAwsEnvironmentCredentials` in `PluginRegistryConfig`
- Bump dev dependencies

## [0.5.0] - 2020-12-23
[0.5.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.4.0...v0.5.0

- Migrate from tslint to eslint
- Bump dependencies
- Add support for multiple AWS profiles via `.yarn-plugin-aws-codeartifact.yml` configuration files

## [0.4.0] - 2020-12-11
[0.4.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.3.0...v0.4.0

- Add `upgrade-interactive` and `search` to list of registry commands

## [0.3.0] - 2020-12-08
[0.3.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.2.0...v0.3.0

- Remove `version` command in favor of updating README installation link

## [0.2.0] - 2020-12-05
[0.2.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.1.0...v0.2.0

- Add authorization hook support for `npmRegistries` and `npmScopes`
- Add `migrate` command that migrates `yarn.lock` entries to refer to AWS CodeArtifact for relevant packages
- Rename `info` command to `version`

## [0.1.0] - 2020-12-04
[0.1.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/f264569...v0.1.0

- Initial release
