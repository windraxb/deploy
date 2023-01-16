// @ts-nocheck
import upath from 'upath'
import util from 'util'
import { EventEmitter } from 'events'
import Promise from 'bluebird';
import fs from 'fs'
import PromiseFtp from 'promise-ftp'
import PromiseSftp from 'ssh2-sftp-client'
import { parseLocal, checkInclude, countFiles, getPassword, deleteDir } from './util';
import { createLogger } from './log'
import { UserConfig } from './interface/IUserConfig';

const logger = createLogger()

export const FtpDeployer = function () {
  // The constructor for the super class.
  EventEmitter.call(this);
  this.ftp = null;
  this.eventObject = {
    totalFilesCount: 0,
    transferredFileCount: 0,
    filename: ''
  };

  this.makeAllAndUpload = function (remoteDir, filemap) {
    let keys = Object.keys(filemap);
    return Promise.mapSeries(keys, (key) => {
      // console.log("Processing", key, filemap[key]);
      return this.makeAndUpload(remoteDir, key, filemap[key]);
    });
  };

  this.makeDir = function (newDirectory) {
    if (newDirectory === '/') {
      return Promise.resolve('unused');
    } else {
      return this.ftp.mkdir(newDirectory, true);
    }
  };
  // Creates a remote directory and uploads all of the files in it
  // Resolves a confirmation message on success
  this.makeAndUpload = (config: UserConfig, relDir, fnames) => {
    let newDirectory = upath.join(config.remotePath, relDir);
    return this.makeDir(newDirectory, true).then(() => {
      // console.log("newDirectory", newDirectory);
      return Promise.mapSeries(fnames, (fname) => {
        let tmpFileName = upath.join(config.localPath, relDir, fname);
        let tmp = fs.readFileSync(tmpFileName);
        this.eventObject['filename'] = upath.join(relDir, fname);

        this.emit('uploading', this.eventObject);
        logger.info('uploading', '...');

        return this.ftp
          .put(tmp, upath.join(config.remotePath, relDir, fname))
          .then(() => {
            this.eventObject.transferredFileCount++;
            this.emit('uploaded', this.eventObject);
            logger.success('uploaded:', tmpFileName);
            return Promise.resolve('uploaded ' + tmpFileName);
          })
          .catch((err) => {
            this.eventObject['error'] = err;
            this.emit('upload-error', this.eventObject);
            logger.error('upload error:', err);
            // if continue on error....
            return Promise.reject(err);
          });
      });
    });
  };

  // connects to the server, Resolves the config on success
  this.connect = (config: UserConfig) => {
    this.ftp = config.sftp ? new PromiseSftp() : new PromiseFtp();

    // sftp client does not provide a connection status
    // so instead provide one ourselfs
    if (config.sftp) {
      this.connectionStatus = 'disconnected';
      this.ftp.on('end', this.handleDisconnect);
      this.ftp.on('close', this.handleDisconnect);
    }

    logger.info('connecting', '...');

    return this.ftp
      .connect(config)
      .then((serverMessage) => {
        logger.success('connect', 'Connected to: ' + config.host);
        logger.success('connect success!');
        this.emit('log', 'Connected to: ' + config.host);
        this.emit('log', 'Connected: Server message: ' + serverMessage);

        // sftp does not provide a connection status
        // so instead provide one ourself
        if (config.sftp) {
          this.connectionStatus = 'connected';
        }

        return config;
      })
      .catch((err) => {
        logger.error('connect fail:', err);
        return Promise.reject({
          code: err.code,
          message: 'connect: ' + err.message
        });
      });
  };

  this.getConnectionStatus = () => {
    // only ftp client provides connection status
    // sftp client connection status is handled using events
    return typeof this.ftp.getConnectionStatus === 'function' ? this.ftp.getConnectionStatus() : this.connectionStatus;
  };

  this.handleDisconnect = () => {
    this.connectionStatus = 'disconnected';
  };

  // creates list of all files to upload and starts upload process
  this.checkLocalAndUpload = (config: UserConfig) => {
    try {
      let filemap = parseLocal({
        includes: config.include,
        excludes: config.exclude,
        localRootDir: config.localPath,
        relDir: '/'
      });
      this.emit('log', 'Files found to upload: ' + JSON.stringify(filemap));
      this.eventObject['totalFilesCount'] = countFiles(filemap);

      return this.makeAllAndUpload(config, filemap);
    } catch (e) {
      return Promise.reject(e);
    }
  };

  // Deletes remote directory if requested by config
  // Returns config
  this.deleteRemote = (config: UserConfig) => {
    if (config.deleteRemote) {
      return deleteDir(this.ftp, config.remotePath)
        .then(() => {
          this.emit('log', 'Deleted directory: ' + config.remotePath);
          return config;
        })
        .catch((err) => {
          this.emit('log', 'Deleting failed, trying to continue: ' + JSON.stringify(err));
          return Promise.resolve(config);
        });
    }
    return Promise.resolve(config);
  };

  this.deploy = function (config: UserConfig, cb) {
    return checkInclude(config)
      .then(getPassword)
      .then(this.connect)
      .then(this.deleteRemote)
      .then(this.checkLocalAndUpload)
      .then((res) => {
        this.ftp.end();
        if (typeof cb === 'function') {
          cb(null, res);
        } else {
          return Promise.resolve(res);
        }
      })
      .catch((err) => {
        console.log('Err', err.message);
        if (this.ftp && this.getConnectionStatus() !== 'disconnected') this.ftp.end();
        if (typeof cb === 'function') {
          cb(err, null);
        } else {
          return Promise.reject(err);
        }
      });
  };
};

util.inherits(FtpDeployer, EventEmitter);
