# `yarn-plugin-aws-codeartifact`

This is a Yarn v3 plugin that resolves authentication for AWS CodeArtifact NPM registries.

For Yarn v2 support, install [v0.7.6](https://github.com/mhassan1/yarn-plugin-aws-codeartifact/tree/v0.7.6) or earlier.

## Install

```
yarn plugin import https://raw.githubusercontent.com/mhassan1/yarn-plugin-aws-codeartifact/v0.7.6/bundles/@yarnpkg/plugin-aws-codeartifact.js
```

## Usage

1. Configure [AWS SDK credentials](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html).
2. Put the AWS CodeArtifact Registry URL in `.yarnrc.yml`:
```yaml
# .yarnrc.yml

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

### AWS Profiles

If you have configured multiple [AWS Profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html),
(e.g. in an AWS credentials file like `~/.aws/credentials` (Linux & Mac) or `%USERPROFILE%\.aws\credentials` (Windows))
you can specify the profile to use by specifying the `AWS_PROFILE` environment variable.

For more fine-grained control, you can add a `.yarn-plugin-aws-codeartifact.yml` configuration file
in your project directory, any parent directory, or the home directory (similar to `.yarnrc.yml`):
```yaml
# .yarn-plugin-aws-codeartifact.yml

npmRegistryServerConfig: PluginRegistryConfig
# OR
npmPublishRegistryConfig: PluginRegistryConfig
# OR
npmRegistries:
  //domain-test-000000000000.d.codeartifact.us-east-1.amazonaws.com/npm/repo-test/: PluginRegistryConfig
# OR
npmScopes:
  my-scope:
    npmRegistryServerConfig: PluginRegistryConfig
    # OR
    npmPublishRegistryConfig: PluginRegistryConfig
```
where `PluginRegistryConfig` contains the following properties:
* `awsProfile` - Name of the AWS Profile to use for this registry
  * An `awsProfile` value (including `''`, which is equivalent to `'default'`) will override the `AWS_PROFILE` environment variable;
    otherwise, the `AWS_PROFILE` environment variable will be used (or if it is unset, the default profile will be used).
* `preferAwsEnvironmentCredentials` - Whether to prefer AWS credentials provided by environment variables, i.e. `AWS_ACCESS_KEY_ID` (default `false`)
  * By default, if `awsProfile` is provided, AWS SDK v3 will look for that profile only and fail if it doesn't exist on the machine.
  * Set this flag to check for environment variable credentials first, and only attempt to use the profile if credentials are not provided by environment variables.
  * This flag is useful in the scenario where developers will use profiles but CI environments will use environment variables.
```yaml
# PluginRegistryConfig

# Name of the AWS Profile to use for this registry.
# 
awsProfile: aws-profile

# By default, if `awsProfile` is provided, AWS SDK v3 will look for that profile and fail if it doesn't exist on the machine.
# Set this to `true` to first check for AWS credentials provided by environment variables (i.e. `AWS_ACCESS_KEY_ID`);
#   
preferAwsEnvironmentCredentials: true
```

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
