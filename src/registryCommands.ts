import { npmConfigUtils } from '@yarnpkg/plugin-npm'
import { arrayStartsWith } from './utils'

const { FETCH_REGISTRY, PUBLISH_REGISTRY } = npmConfigUtils.RegistryType

type RegistryCommand = {
  // these are the first positional arguments of the command
  positionalArgs: string[]
  // function that returns which registry type the command requires (or `null` if none is required)
  // defaults to FETCH_REGISTRY
  registryFn?: (yargsParserOutput: { [key: string]: string | boolean }) => npmConfigUtils.RegistryType | null
  // if specified, number of positional arguments to splice off before re-evaluating the command
  shiftPositionalArgs?: number
}

/* istanbul ignore next */
/**
 * List of `yarn` commands that require a registry, and which registry type they require
 */
export const registryCommands: RegistryCommand[] = [
  {
    positionalArgs: ['add']
  },
  {
    positionalArgs: ['create']
  },
  {
    positionalArgs: ['dedupe']
  },
  {
    positionalArgs: ['dlx']
  },
  {
    positionalArgs: ['info']
  },
  {
    positionalArgs: ['install']
  },
  {
    positionalArgs: ['link']
  },
  {
    positionalArgs: ['npm', 'audit'],
    registryFn: () => PUBLISH_REGISTRY
  },
  {
    positionalArgs: ['npm', 'info']
  },
  {
    positionalArgs: ['npm', 'login'],
    registryFn: ({ publish }) => (publish ? PUBLISH_REGISTRY : FETCH_REGISTRY)
  },
  {
    positionalArgs: ['npm', 'logout'],
    registryFn: ({ publish }) => (publish ? PUBLISH_REGISTRY : FETCH_REGISTRY)
  },
  {
    positionalArgs: ['npm', 'publish'],
    registryFn: () => PUBLISH_REGISTRY
  },
  {
    positionalArgs: ['npm', 'whoami'],
    registryFn: ({ publish }) => (publish ? PUBLISH_REGISTRY : FETCH_REGISTRY)
  },
  {
    positionalArgs: ['npm', 'tag', 'add'],
    registryFn: () => PUBLISH_REGISTRY
  },
  {
    positionalArgs: ['npm', 'tag', 'list']
  },
  {
    positionalArgs: ['npm', 'tag', 'remove'],
    registryFn: () => PUBLISH_REGISTRY
  },
  {
    positionalArgs: ['pack'],
    registryFn: ({ installIfNeeded }) => (installIfNeeded ? FETCH_REGISTRY : null)
  },
  {
    positionalArgs: ['rebuild']
  },
  {
    positionalArgs: ['remove']
  },
  {
    positionalArgs: ['search']
  },
  {
    positionalArgs: ['set', 'resolution']
  },
  {
    positionalArgs: ['unplug']
  },
  {
    positionalArgs: ['up']
  },
  {
    positionalArgs: ['upgrade-interactive']
  },
  {
    positionalArgs: ['workspace'],
    shiftPositionalArgs: 2
  },
  {
    positionalArgs: ['workspaces', 'focus']
  },
  {
    positionalArgs: ['workspaces', 'foreach'],
    shiftPositionalArgs: 2
  },

  // lerna commands
  {
    positionalArgs: ['lerna', 'add']
  },
  {
    positionalArgs: ['lerna', 'bootstrap']
  },
  {
    positionalArgs: ['lerna', 'publish'],
    registryFn: () => PUBLISH_REGISTRY
  },
  {
    positionalArgs: ['lerna', 'run'],
    shiftPositionalArgs: 2
  }
]

/**
 * Given a list of positional arguments in a command, find the relevant registry command from the list
 *
 * @param {string[]} positionalArgs - Positional arguments (e.g. `['add', 'moment']` in `yarn add moment`)
 * @returns {RegistryCommand} Found registry command
 */
export const findRegistryCommand = (positionalArgs: (string | number)[]): RegistryCommand | null => {
  return (
    registryCommands.find(({ positionalArgs: commandPositionalArgs }) => {
      return arrayStartsWith(positionalArgs, ...commandPositionalArgs)
    }) || null
  )
}
