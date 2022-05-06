import request from 'supertest';
import app from '../src/app';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import { Hoax } from '../src/entities/Hoax';
import { FileAttachment } from '../src/entities/FileAttachment';
import bcrypt from 'bcrypt';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import { DynamicTestInterface, ErrorInterface, OptionInterface, Response } from './definitions/custom';
import fs from 'fs';
import path from 'path';
import config from 'config';

const uploadDir: string = config.get('uploadDir');
const attachmentDir: string = config.get('attachmentDir');
const attachmentFolder = path.join('.', uploadDir, attachmentDir);

const filename = 'test-file-hoax-delete' + Date.now().toString();
const targetPath = path.join(attachmentFolder, filename);
const testFilePath = path.join('.', '__tests__', 'resources', 'test-png.png');

// GENERAL SETTINGS
beforeAll(async () => {
  await db.initialize();
});
beforeEach(async () => {
  await db.manager.delete(FileAttachment, {});
  await db.manager.delete(Hoax, {});
  await db.manager.delete(User, {});
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
});
afterAll(async () => {
  await db.destroy();
});

const activeUser = {
  username: 'user1',
  email: 'user1@email.com',
  password: 'P4ssword',
  inactive: false,
};

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return db.manager.save(User, user);
};

const addHoax = async (userId: number) => {
  const insertResult = await db.manager.insert(Hoax, {
    content: 'Hoax for user',
    timestamp: Date.now(),
    userId: userId,
  });
  return insertResult.raw as number;
};

const addFileAttachment = async (hoaxId: number) => {
  fs.copyFileSync(testFilePath, targetPath);
  const attach = await db.manager.insert(FileAttachment, {
    filename: filename,
    uploadDate: Date.now(),
    hoaxId: hoaxId,
    fileType: 'image/png',
  });
  return attach.raw as number;
};

const auth = async (options: OptionInterface = {}) => {
  const res: Response<{ token: string }> = await request(app).post('/api/1.0/auth').send(options.auth);

  return res.body.token;
};

const deleteHoax = async (id = 5, options: OptionInterface = {}) => {
  const agent = request(app).delete('/api/1.0/hoaxes/' + id.toString());
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  if (options.token) {
    void agent.set('Authorization', `Bearer ${options.token}`);
  }
  const res: Response<ErrorInterface> = await agent.send();
  return res;
};

describe('Delete Hoax', () => {
  it('return 403 when request is unauthorized', async () => {
    const res = await deleteHoax();
    expect(res.status).toBe(403);
  });

  it('return 403 when token is invalid', async () => {
    const res = await deleteHoax(5, { token: 'abcde' });
    expect(res.status).toBe(403);
  });

  it.each`
    language | message
    ${'es'}  | ${es.unauthorized_hoax_delete}
    ${'en'}  | ${en.unauthorized_hoax_delete}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async ({ language, message }: DynamicTestInterface) => {
      const nowInMillis = Date.now();
      const res = await deleteHoax(5, { language });
      expect(res.body.path).toBe('/api/1.0/hoaxes/5');
      expect(res.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(res.body.message).toBe(message);
    }
  );

  it('returns 403 when a user tries to delete another user hoax', async () => {
    const user = await addUser();
    const hoaxId = await addHoax(user.id as number);
    const user2 = await addUser({ ...activeUser, username: 'user2', email: 'user2@email.com' });
    const token = await auth({
      auth: {
        email: user2.email,
        password: 'P4ssword',
      },
    });
    const res = await deleteHoax(hoaxId, { token });
    expect(res.status).toBe(403);
  });

  it('returns 200 ok when user deletes their hoax', async () => {
    const user = await addUser();
    const hoaxId = await addHoax(user.id as number);
    const token = await auth({
      auth: {
        email: user.email,
        password: 'P4ssword',
      },
    });
    const res = await deleteHoax(hoaxId, { token });
    expect(res.status).toBe(200);
  });

  it('removes the hoax from database when user deletes their hoax', async () => {
    const user = await addUser();
    const hoaxId = await addHoax(user.id as number);
    const token = await auth({
      auth: {
        email: user.email,
        password: 'P4ssword',
      },
    });
    await deleteHoax(hoaxId, { token });
    const hoaxInDB = await db.manager.findOne(Hoax, {
      where: {
        id: hoaxId,
      },
    });
    expect(hoaxInDB).toBeNull();
  });

  it('removes the file attachment from database when user deletes their hoax', async () => {
    const user = await addUser();
    const hoaxId = await addHoax(user.id as number);
    const attachId = await addFileAttachment(hoaxId);
    const token = await auth({
      auth: {
        email: user.email,
        password: 'P4ssword',
      },
    });
    await deleteHoax(hoaxId, { token });
    const attachInDB = await db.manager.findOne(FileAttachment, {
      where: {
        id: attachId,
      },
    });
    expect(attachInDB).toBeNull();
  });

  it('removes the file from storage when user deletes their hoax', async () => {
    const user = await addUser();
    const hoaxId = await addHoax(user.id as number);
    await addFileAttachment(hoaxId);
    const token = await auth({
      auth: {
        email: user.email,
        password: 'P4ssword',
      },
    });
    await deleteHoax(hoaxId, { token });
    expect(fs.existsSync(targetPath)).toBe(false);
  });
});
