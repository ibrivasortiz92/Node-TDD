import fs from 'fs';
import path from 'path';
import config from 'config';
import { randomString } from '../utils/generator';
import FileType from 'file-type';

const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const profileFolder = path.join('.', uploadDir, profileDir);

const createFolders = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  if (!fs.existsSync(profileFolder)) {
    fs.mkdirSync(profileFolder);
  }
};

const saveProfileImage = async (base64File?: string) => {
  if (base64File) {
    const filename = randomString(32);
    const filePath = path.join(profileFolder, filename);
    await fs.promises.writeFile(filePath, base64File, 'base64');
    return filename;
  }
  return null;
};

const deleteProfileImage = async (filename: string) => {
  const filePath = path.join(profileFolder, filename);
  await fs.promises.unlink(filePath);
};

const isLessThan2MB = (buffer: Buffer) => {
  return buffer.length <= 2 * 1024 * 1024;
};

const isSupportedFileType = async (buffer: Buffer) => {
  const type = await FileType.fromBuffer(buffer);
  return !type ? false : type.mime === 'image/png' || type.mime === 'image/jpeg';
};

export default {
  createFolders,
  saveProfileImage,
  deleteProfileImage,
  isLessThan2MB,
  isSupportedFileType,
};
