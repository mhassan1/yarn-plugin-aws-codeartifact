# Changelog

## [0.7.0] - 2020-12-29
[0.7.0]: https://github.com/mhassan1/yarn-plugin-aws-codeartifact/compare/v0.6.1...v0.7.0

- Fixed: Prettier formatting
- Added: yarn prettier-check command
- Fixed: VS Code integration

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
