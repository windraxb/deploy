# @windraxb/ftp-deploy

## 配置说明

```typescript
export interface UserConfig {
  /**
   * 服务器登录用户
   */
  user: string;
  /**
   * 服务器登录密码
   */
  password: string;
  /**
   *  服务器地址
   */
  host: string;
  /**
   * 服务器端口，ftp 常用为21，sftp 为 22
   */
  port: number;
  /**
   * 本地上传文件路径
   */
  localPath: string;
  /**
   * 服务器上传路径
   */
  remotePath: string;
  /**
   * 上传包含文件
   */
  include: string[];
  /**
   * 上传不包含文件
   */
  exclude: string[];
  /**
   * 是否删除目标路径所有文件
   */
  deleteRemote: boolean;
  /**
   * 是否使用sftp
   */
  sftp: boolean;
}
```

## 使用说明

```js
import { FtpDeployer } from '@windraxb/ftp-deploy'
import path from 'path'
import { fileURLToPath } from 'url';

const ftpDeploy = new FtpDeployer()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const config = {
  user: 'test',
  password: 'passwordForTest',
  host: '127.0.0.1',
  port: 22,
  localPath: path.join(__dirname, '/demo'),
  remotePath: '/usr/local/nginx/html/demo',
  include: ['*'],
  exclude: ['dist/**/*.map', 'node_modules/**', 'node_modules/**/.*', '.git/**'],
  deleteRemote: false,
  sftp: true
}

ftpDeploy
  .deploy(config)
  .then(res => console.log('上传成功:', res))
  .catch(err => console.log(err))

```
