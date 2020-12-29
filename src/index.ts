import { Plugin } from '@yarnpkg/core'
import './authHook'
import { MigrateCommand } from './commands/migrate'

const plugin: Plugin = {
  commands: [MigrateCommand]
}
export default plugin
