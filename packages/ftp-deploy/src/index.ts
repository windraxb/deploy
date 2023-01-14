// @ts-nocheck
import upath from 'upath'
import { EventEmitter } from 'events'
import { Promise } from 'bluebird';
import fs from 'fs'
import PromiseFtp from 'promise-ftp'
import PromiseSftp from 'ssh2-sftp-client'
import { parseLocal, checkInclude, countFiles, getPassword, deleteDir } from './util';
import { createLogger } from './log'
import { UserConfig } from './interface/IUserConfig';

const logger = createLogger()

type Event = {
  totalFilesCount: number
  transferredFileCount: number
  filename: string,
  error: null | unknown
}

export class FtpDeployer extends EventEmitter {

  ftp: PromiseFtp | PromiseSftp | null = null

  eventObject: Event = {
    totalFilesCount: 0,
    transferredFileCount: 0,
    filename: '',
    error: null
  }

  /**
   * 服务器连接状态
   */
  connectionStatus: 'disconnected' | 'connected' = 'disconnected'

  constructor() {
    super()
    this.ftp = null;
    this.eventObject = {
      totalFilesCount: 0,
      transferredFileCount: 0,
      filename: '',
      error: null
    }
  }

  makeAllAndUpload (remoteDir: UserConfig, fileMap: Record<string, unknown[]>) {
    const keys = Object.keys(fileMap)

    return Promise.mapSeries(keys, (key) => {
      return this.makeAndUpload(remoteDir, key, fileMap[key])
    })
  }

  makeDir (newDirectory: string) {
    if (newDirectory === '/') {
      return Promise.resolve('unused')
    } else {
      return this.ftp!.mkdir(newDirectory, true)
    }
  }

  /**
   * 创建远程目录并且上传文件
   * @param config
   * @param relDir
   * @param fnames
   */
  makeAndUpload(config: UserConfig, relDir: string, fnames: unknown[]) {
    let newDirectory = upath.join(config.remotePath, relDir)

    // @ts-ignore
    return this.makeDir(newDirectory).then(() => {
      return Promise.mapSeries(fnames, fname => {
        let tmpFileName = upath.join(config.localPath, relDir, fname)
        let tmp = fs.readFileSync(tmpFileName)
        this.eventObject.filename = upath.join(relDir, fname)

        this.emit('uploading', this.eventObject)
        logger.info('uploading', '...')

        // @ts-ignore
        return this.ftp!
          .put(tmp, upath.join(config.remotePath, relDir, fname))
          .then(() => {
            this.eventObject.transferredFileCount++
            this.emit('uploaded', this.eventObject)
            logger.success('uploaded:', tmpFileName)
            return Promise.resolve('uploaded' + tmpFileName)
          })
          .catch((err: unknown) => {
            this.eventObject.error = err
            this.emit('upload-error', this.eventObject)
            logger.error('upload error:', err)
            return Promise.reject(err)
          })
      })
    })
  }

  /**
   * 连接远程地址
   * @param config
   */
  connect(config:UserConfig) {
    this.ftp = config.sftp ? new PromiseSftp() : new PromiseFtp()
    if (this.ftp instanceof PromiseSftp) {
      this.connectionStatus = 'disconnected'
      this.ftp.on('end', this.handleDisconnect)
      this.ftp.on('close', this.handleDisconnect)
    }

    logger.info('connecting', '...')

    return this.ftp
      .connect(config)
      .then((serverMessage: string) => {
        logger.success('connect', `Connected to: ${config.host}`)
        logger.success('connect success')
        this.emit('log', `Connected to: ${config.host}`)
        this.emit('log', `Connected: Server message: ${serverMessage}`)

        if (config.sftp) {
          this.connectionStatus = 'connected'
        }

        return config
      }).catch((err: { code: string, message: string}) => {
        logger.error('connect fail:', err);
        return Promise.reject({
          code: err.code,
          message: 'connect: ' + err.message
        })
      })
  }

  getConnectionStatus() {
    return this.ftp instanceof PromiseSftp ? this.connectionStatus : this.ftp!.getConnectionStatus()
  }

  handleDisconnect() {
    this.connectionStatus = 'disconnected'
  }

  checkLocalAndUpload(config: UserConfig) {
    try {
      let filemap = parseLocal({
        includes: config.include,
        excludes: config.exclude,
        localRootDir: config.localPath,
        relDir: '/'
      })

      this.emit('log', 'Files found to upload: ' + JSON.stringify(filemap))
      this.eventObject.totalFilesCount = countFiles(filemap)

      return this.makeAllAndUpload(config, filemap)
    } catch (e) {
      return Promise.reject(e)
    }
  }

  deleteRemote(config: UserConfig) {
    if (config.deleteRemote) {
      return deleteDir(this.ftp, config.remotePath)
        .then(() => {
          this.emit('log', 'Deleted directory: ' + config.remotePath);
          return config;
        })
        .catch((err: any) => {
          this.emit('log', 'Deleting failed, trying to continue: ' + JSON.stringify(err));
          return Promise.resolve(config)
        })
    }
    return Promise.resolve(config)
  }

  deploy (config: UserConfig, cb?: Function) {
    return checkInclude(config)
      .then(getPassword)
      .then(this.connect.bind(this))
      .then(this.deleteRemote.bind(this))
      .then(this.checkLocalAndUpload.bind(this))
      .then((res) => {
        this.ftp?.end()
        if (typeof cb === 'function') {
          cb(null, res)
        } else {
          return Promise.resolve(res)
        }
      })
      .catch(err => {
        console.log('Err', err.message)
        if (this.ftp && this.getConnectionStatus() !== 'disconnected') {
          if (typeof cb === 'function') {
            cb(err, null)
          } else {
            return Promise.reject(err)
          }
        }
      })
  }
}
