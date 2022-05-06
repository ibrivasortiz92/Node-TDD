import fs from 'fs';
import path from 'path';
import config from 'config';

// GENERAL SETTINGS
const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const attachmentDir: string = config.get('attachmentDir');
const profileDirectory = path.join('.', uploadDir, profileDir);
const attachmentDirectory = path.join('.', uploadDir, attachmentDir);

const clearFolders = (folder: string) => {
  const files = fs.readdirSync(folder);
  for (const file of files) {
    fs.unlinkSync(path.join(folder, file));
  }
};

clearFolders(profileDirectory);
clearFolders(attachmentDirectory);
