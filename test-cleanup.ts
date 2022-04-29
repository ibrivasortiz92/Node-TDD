import fs from 'fs';
import path from 'path';
import config from 'config';

// GENERAL SETTINGS
const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const profileDirectory = path.join('.', uploadDir, profileDir);

const files = fs.readdirSync(profileDirectory);
for (const file of files) {
  fs.unlinkSync(path.join(profileDirectory, file));
}
