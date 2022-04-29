import request from 'supertest';
import app from '../src/app';
import fs from 'fs';
import path from 'path';
import config from 'config';

const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const profileFolder = path.join('.', uploadDir, profileDir);

describe('Profile Images', () => {
  const copyFile = () => {
    const filePath = path.join('.', '__tests__', 'resources', 'test-png.png');
    const storedFileName = 'test-file';
    const targetPath = path.join(profileFolder, storedFileName);
    fs.copyFileSync(filePath, targetPath);
    return storedFileName;
  };

  it('returns 404 when file not found', async () => {
    const res = await request(app).get('/images/123456');
    expect(res.status).toBe(404);
  });

  it('returns 200 ok when file exist', async () => {
    copyFile();
    const res = await request(app).get('/images/test-file');
    expect(res.status).toBe(200);
  });

  it('returns cache for 1 year in response', async () => {
    copyFile();
    const res = (await request(app).get('/images/test-file')) as unknown as Record<string, Record<string, unknown>>;
    const oneYearInSeconds = 365 * 24 * 60 * 60;
    expect(res.header['cache-control']).toContain(`max-age=${oneYearInSeconds}`);
  });
});
