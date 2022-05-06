import request from 'supertest';
import app from '../src/app';
import path from 'path';
import { FileAttachment } from '../src/entities/FileAttachment';
import db from '../database/dataSource';
import fs from 'fs';
import config from 'config';
import es from '../locales/es/translation.json';
import en from '../locales/en/translation.json';
import { DynamicTestInterface, ErrorInterface, OptionInterface, Response } from './definitions/custom';

const uploadDir: string = config.get('uploadDir');
const attachmentDir: string = config.get('attachmentDir');

// SETTINGS
beforeAll(async () => {
  await db.initialize();
});
beforeEach(async () => {
  await db.manager.delete(FileAttachment, {});
});
afterAll(async () => {
  await db.destroy();
});

const uploadFile = async (file = 'test-png.png', options: OptionInterface = {}) => {
  const agent = request(app).post('/api/1.0/hoaxes/attachments');
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  const res: Response<ErrorInterface> = await agent.attach('file', path.join('.', '__tests__', 'resources', file));
  return res;
};

describe('Upload File for Hoax', () => {
  it('returns 200 ok after succesful upload', async () => {
    const res = await uploadFile();
    expect(res.status).toBe(200);
  });

  it('saves dynamicFilename, uploadDate as attachment object in database', async () => {
    const beforeSubmit = Date.now();
    await uploadFile();
    const attachments = await db.manager.find(FileAttachment);
    const attachment = attachments[0];
    expect(attachment.filename).not.toBe('test-png.png');
    expect(attachment.uploadDate).toBeGreaterThan(beforeSubmit);
  });

  it('saves file to attachment folder', async () => {
    await uploadFile();
    const attachments = await db.manager.find(FileAttachment);
    const attachment = attachments[0];
    const filePath = path.join('.', uploadDir, attachmentDir, attachment.filename);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it.each`
    file              | fileType
    ${'test-png.png'} | ${'image/png'}
    ${'test-png'}     | ${'image/png'}
    ${'test-gif.gif'} | ${'image/gif'}
    ${'test-jpg.jpg'} | ${'image/jpeg'}
    ${'test-pdf.pdf'} | ${'application/pdf'}
    ${'test-txt.txt'} | ${'non'}
  `(
    'saves filetype as $fileType in attachment object when $file is uploaded',
    async ({ file, fileType }: { file: string; fileType: string }) => {
      await uploadFile(file);
      const attachments = await db.manager.find(FileAttachment);
      const attachment = attachments[0];
      expect(attachment.fileType).toBe(fileType);
    }
  );

  it.each`
    file              | fileExtension
    ${'test-png.png'} | ${'png'}
    ${'test-png'}     | ${'png'}
    ${'test-gif.gif'} | ${'gif'}
    ${'test-jpg.jpg'} | ${'jpg'}
    ${'test-pdf.pdf'} | ${'pdf'}
    ${'test-txt.txt'} | ${'non'}
  `(
    'saves filename with extension $fileExtension in attachment object and stored object when $file is uploaded',
    async ({ file, fileExtension }: { file: string; fileExtension: string }) => {
      await uploadFile(file);
      const attachments = await db.manager.find(FileAttachment);
      const attachment = attachments[0];
      if (file === 'test-txt.txt') {
        expect(attachment.filename.endsWith('txt')).toBe(false);
      } else {
        expect(attachment.filename.endsWith(fileExtension)).toBe(true);
      }
      const filePath = path.join('.', uploadDir, attachmentDir, attachment.filename);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  );

  it('returns 400 when uploaded filesize is bigger than 5mb', async () => {
    const fiveMB = 5 * 1024 * 1024;
    const filePath = path.join('.', '__tests__', 'resources', 'random-file');
    fs.writeFileSync(filePath, 'a'.repeat(fiveMB) + 'a');
    const res = await uploadFile('random-file');
    expect(res.status).toBe(400);
    fs.unlinkSync(filePath);
  });

  it('returns 200 ok when uploaded file size is 5mb', async () => {
    const fiveMB = 5 * 1024 * 1024;
    const filePath = path.join('.', '__tests__', 'resources', 'random-file');
    fs.writeFileSync(filePath, 'a'.repeat(fiveMB));
    const res = await uploadFile('random-file');
    expect(res.status).toBe(200);
    fs.unlinkSync(filePath);
  });

  it.each`
    language | message
    ${'en'}  | ${en.attachment_size_limit}
    ${'es'}  | ${es.attachment_size_limit}
  `('returns $message when attachment size is bigger than 5mb', async ({ language, message }: DynamicTestInterface) => {
    const fiveMB = 5 * 1024 * 1024;
    const filePath = path.join('.', '__tests__', 'resources', 'random-file');
    fs.writeFileSync(filePath, 'a'.repeat(fiveMB) + 'a');
    const nowInMillis = Date.now();
    const res = await uploadFile('random-file', { language });
    const error = res.body;
    expect(error.path).toBe('/api/1.0/hoaxes/attachments');
    expect(error.message).toBe(message);
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    fs.unlinkSync(filePath);
  });

  it('returns attachment id in response', async () => {
    const res = await uploadFile();
    expect(Object.keys(res.body)).toEqual(['id']);
  });
});
