// @ts-nocheck
import fs from 'fs'
import path from 'path'
import Promise from 'bluebird'
import read from 'read'
import minimatch from 'minimatch'
import { UserConfig } from './interface/IUserConfig';
import { PARSE_LOCAL_INTERFACE } from './interface/IParseLocalInterface'
import PromiseFtp from 'promise-ftp';
import PromiseSftp, { FileInfo } from 'ssh2-sftp-client';


/**
 * 检查include
 * @param config
 */
export function checkInclude(config: UserConfig) {
  config.exclude = config.exclude || []
  if (!config.include?.length) {
    return Promise.reject({
      code: 'NoIncludes',
      message: `You need to specify files to upload - e.g. ['*', '**/*']`
    })
  }
  return Promise.resolve(config)
}

/**
 * 获取服务端密码
 * @param config
 */
export function getPassword (config: UserConfig) {
  if (config.password) {
    return Promise.resolve(config)
  } else {
    let options = {
      prompt: `Password for ${config.user}@${config.host}（Enter for none）:`,
      default: '',
      silent: true
    }

    return read(options).then(res => {
      return Object.assign(config, { password: res })
    })
  }
}

/**
 * 是否可以上传
 * @param includes
 * @param excludes
 * @param filePath
 */
export function canIncludePath (includes: string[], excludes: string[], filePath: string) {
  let includeGo = (acc: boolean, item: string) => acc || minimatch(filePath, item, { matchBase: true })
  let canInclude = includes.reduce(includeGo, false)

  if (canInclude) {
    if (excludes) {
      let excludeGo = (acc: boolean, item: string) => acc && !minimatch(filePath, item, { matchBase: true })
      canInclude = excludes.reduce(excludeGo, true)
    }
  }

  return canInclude
}

/**
 * 解析本地资源并存储在集合里
 * @param includes
 * @param excludes
 * @param localRootDir
 * @param relDir
 */
export function parseLocal({ includes, excludes, localRootDir, relDir}: PARSE_LOCAL_INTERFACE) {
  const fullDir = path.join(localRootDir, relDir)
  let handleItem = (acc: Record<string, unknown[]>, item: string) => {
    const currItem = path.join(fullDir, item)
    const newRelDir = path.relative(localRootDir, currItem)

    if (fs.lstatSync(currItem).isDirectory()) {
      let tmp: Record<string, unknown[]> = parseLocal({ includes, excludes, localRootDir, relDir: newRelDir})
      Object.keys(tmp).forEach(key => {
        if (tmp[key].length === 0) {
          delete tmp[key]
        }
      })

      return Object.assign(acc, tmp)
    } else {
      if (canIncludePath(includes, excludes, newRelDir)) {
        acc[relDir].push(item)
        return acc
      }
    }

    return acc
  }

  if (!fs.existsSync(fullDir)) {
    throw new Error(`${fullDir} is not an existing location`)
  }

  const files = fs.readdirSync(fullDir)

  let acc: Record<string, unknown[]> = {}
  acc[relDir] = []
  return files.reduce(handleItem, acc)
}


export function deleteDir(ftp: PromiseFtp | PromiseSftp, dir: string) {
  return ftp.list(dir).then((list: FileInfo[]) => {
    let dirNames = list
      .filter((f: FileInfo) => f.type === 'd' && f.name !== '..' && f.name !== '.')
      .map((f:FileInfo) => path.posix.join(dir,f.name))

    let fnames = list
      .filter(f => f.type !== 'd')
      .map((f) => path.posix.join(dir, f.name))

    return Promise.mapSeries(dirNames, (dirName) => {
      return deleteDir(ftp, dirName).then(() => ftp.rmdir(dirName))
    }).then(() => Promise.mapSeries(fnames, (fname) => ftp.delete(fname)))
  })
}

export function countFiles(fileMap: Record<string, unknown[]>) {
  return Object.values(fileMap).reduce((acc, item) => acc.concat(item)).length
}
