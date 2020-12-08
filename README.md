# `yarn-plugin-aws-codeartifact`

This is a Yarn v2 plugin that resolves authentication for AWS CodeArtifact NPM registries.

## Install

```
yarn plugin import https://raw.githubusercontent.com/mhassan1/yarn-plugin-aws-codeartifact/v0.3.0/bundles/@yarnpkg/plugin-aws-codeartifact.js
```

## Usage

1. Configure [AWS SDK credentials](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html).
2. Put the AWS CodeArtifact Registry URL in `.yarnrc.yml`:
```yaml
npmRegistryServer: https://domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/
# OR
npmPublishRegistry: https://domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/
# OR
npmRegistries:
  //domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/: {}
# OR
npmScopes:
  my-scope:
    npmRegistryServer: https://domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/
    # OR
    npmPublishRegistry: https://domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/
```
NOTE: If `publishConfig.registry` is specified in `package.json`,
you must also specify that registry in `npmRegistries` in `.yarnrc.yml`.

3. Run `yarn` commands.

## Migration

To migrate an existing `yarn.lock` file from NPM to AWS CodeArtifact,
run `yarn plugin-aws-codeartifact migrate`, then `yarn`.

For each lock file entry:
1. If it's not an NPM protocol entry, skip it
2. If it's not using the default NPM registry, skip it
3. If it's a scoped package and `npmScopes.<scope>.npmRegistryServer` is an AWS CodeArtifact registry,
   modify the entry to use that registry
4. If `npmRegistryServer` is an AWS CodeArtifact registry,
   modify the entry to use that registry

The `migrate` command itself only modifies the `yarn.lock` file.
To verify the lock file updates and to download the packages from the AWS CodeArtifact registry, run `yarn`.

## How It Works

This plugin hooks into Yarn v2 so that any `yarn` commands that may require fetching or publishing packages
to an AWS CodeArtifact registry will have an AWS CodeArtifact token generated right before.

This is equivalent to setting the following `.yarnrc.yml` fields
(they will be set only for the lifetime of the command and will not be persisted to any `.yarnrc.yml` file or anywhere else):
```yaml
npmAlwaysAuth: true
npmAuthToken: # generated authorization token
```

See `src/registryCommands.ts` for the list of supported `yarn` commands and the type of registry they require.
NOTE: `lerna` commands are also supported, as long as they are run with `yarn lerna ...`.

More info:
* [AWS CodeArtifact tokens](https://docs.aws.amazon.com/codeartifact/latest/ug/tokens-authentication.html)
* [.yarnrc.yml](https://yarnpkg.com/configuration/yarnrc#npmRegistryServer)

## Debugging

`_YARN_PLUGIN_AWS_CODEARTIFACT_DEBUG=* yarn`

## Testing

`yarn test`

NOTE: Integration tests require `yarn build` first.

## Publishing

`npm version <version>`

## License

MIT
