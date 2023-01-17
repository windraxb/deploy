import { resolve } from 'path'
import { readdirSync, existsSync } from 'fs';
import execa from 'execa';
import prompts from 'prompts'
import { bgYellow, bgCyan, bgGreen, bgRed, yellow, cyan, green, red, lightBlue } from 'kolorist'

import type { Options } from 'execa'

type LogFn = () => void

const packages = readdirSync(resolve(__dirname, '../packages'))

export const logger = {
  ln: () => console.log(),
  withStartLn: (log: LogFn) => (logger.ln(), log()),
  withEndLn: (log: LogFn) => (log(), logger.ln()),
  withBothLn: (log: LogFn) => (logger.ln(), log(), logger.ln()),
  warning: (msg: string) => {
    console.warn(`${bgYellow(' WARNING ')} ${yellow(msg)}`)
  },
  info: (msg: string) => {
    console.log(`${bgCyan(' INFO ')} ${cyan(msg)}`)
  },
  success: (msg: string) => {
    console.log(`${bgGreen(' SUCCESS ')} ${green(msg)}`)
  },
  error: (msg: string) => {
    console.error(`${bgRed(' ERROR ')} ${red(msg)}`)
  },
  warningText: (msg: string) => {
    console.warn(`${yellow(msg)}`)
  },
  infoText: (msg: string) => {
    console.log(`${cyan(msg)}`)
  },
  successText: (msg: string) => {
    console.log(`${green(msg)}`)
  },
  errorText: (msg: string) => {
    console.error(`${red(msg)}`)
  }
}

export async function getPackageInfo(inputPkg: string) {
  let pkgName: string | null = null

  if (packages.includes(inputPkg)) {
    pkgName = inputPkg
  } else {
    let options = inputPkg ? packages.filter(p => p.includes(inputPkg)) : packages

    if (!options.length) {
      options = packages
    } else if (options.length === 1) {
      pkgName = options[0]
    } else {
      pkgName = (await prompts({
        type: 'select',
        name: 'pkgName',
        message: 'Select release package:',
        choices: options.map(n => ({title: n, value: n}))
      })).pkgName
    }
  }

  if (!pkgName) {
    throw new Error('Release package must not be null')
  }

  const pkgDir = resolve(__dirname, `../packages/${pkgName}`)
  const pkgPath = resolve(pkgDir, 'package.json')

  if (!existsSync(pkgPath)) {
    throw new Error(`Release package ${pkgName} not found`)
  }

  const pkg = require(pkgPath)

  if (pkg.private) {
    throw new Error(`Release package ${pkgName} is private`)
  }

  return {
    pkgName,
    pkgDir,
    pkgPath,
    pkg,
    currentVersion: pkg.version
  }
}

export async function run(bin: string, args: string[], opts: Options = {}) {
  return execa(bin, args, { stdio: 'inherit', ...opts})
}

export async function dryRun(bin: string, args: string[], opts: Options = {}) {
  console.log(lightBlue(`[dryrun] ${bin} ${args.join(' ')}`), opts)
}
