import { FtpDeployer } from '../dist/index.cjs'
import path from 'path'
import { fileURLToPath } from 'url';

const ftpDeploy = new FtpDeployer()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const config = {
  user: 'root',
  password: '',
  host: '',
  port: 22,
  localPath: path.join(__dirname, '/resource'),
  remotePath: '',
  include: ['*'],
  exclude: ['dist/**/*.map', 'node_modules/**', 'node_modules/**/.*', '.git/**'],
  deleteRemote: true,
  sftp: true
}

ftpDeploy
  .deploy(config)
  .then(res => console.log('finished:', res))
  .catch(err => console.log(err))
