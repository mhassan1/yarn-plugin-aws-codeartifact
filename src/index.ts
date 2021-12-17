import { Plugin } from '@yarnpkg/core'
import { getNpmAuthenticationHeader } from './authHook'
import { MigrateCommand } from './commands/migrate'

const plugin: Plugin = {
  commands: [MigrateCommand],
  hooks: {
    getNpmAuthenticationHeader
  }
}
export default plugin
