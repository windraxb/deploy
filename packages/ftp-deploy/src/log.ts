import * as colors from 'colorette'

type LOG_TYPE = 'info' | 'success' | 'warn' | 'error'

enum LOG_TYPE_COLOR {
  info = 'blue',
  error = 'red',
  warn = 'yellow',
  success = 'green'
}

export const colorize = (type: LOG_TYPE, data: any, onlyImportant = false) => {
  if (onlyImportant && (type === 'info' || type === 'success')) {
    return data
  }

  return colors[LOG_TYPE_COLOR[type]](data)
}

export const makeLabel = (name: string | undefined, input: string, type: LOG_TYPE) => {
  return [
    name && `${colors.dim('[')}${name.toUpperCase()}${colors.dim(']')}`,
    colorize(type, input.toUpperCase())
  ]
    .filter(Boolean)
    .join(' ')
}

let silent = false

export function setSilent (isSilent = false) {
  silent = isSilent
}

export function getSilent () {
  return silent
}

export type Logger = ReturnType<typeof createLogger>

export const createLogger = (name?: string) => {
  return {
    setName(_name: string) {
      name = _name
    },

    log(label: string, type: LOG_TYPE, ...data: unknown[]) {
      switch (type) {
        case 'error': {
          return console.error(makeLabel(name, label, type), ...data.map(item => colorize(type, item, true)))
        }

        default:
          if (silent) return
          console.error(makeLabel(name, label, type), ...data.map(item => colorize(type, item, true)))
      }
    },

    success(label: string, ...args: unknown[]) {
      return this.log(label, 'success', ...args)
    },

    info(label: string, ...args: any[]) {
      return this.log(label, 'info', ...args);
    },

    error(label: string, ...args: any[]) {
      return this.log(label, 'error', ...args);
    },

    warn(label: string, ...args: any[]) {
      return this.log(label, 'warn', ...args);
    }
  }
}
