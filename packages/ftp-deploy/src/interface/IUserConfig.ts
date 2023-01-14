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
