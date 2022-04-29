import FileService from '../src/services/FileService';
import fs from 'fs';
import path from 'path';
import config from 'config';

const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');

describe('createFolders', () => {
  it('creates upload folder', () => {
    FileService.createFolders();
    expect(fs.existsSync(uploadDir)).toBe(true);
  });

  it('creates profile foldre under upload folder', () => {
    FileService.createFolders();
    const profileFolder = path.join('.', uploadDir, profileDir);
    expect(fs.existsSync(profileFolder)).toBe(true);
  });
});
