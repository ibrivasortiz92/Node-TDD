import request from 'supertest';
import app from '../src/app';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import bcrypt from 'bcrypt';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import fs from 'fs';
import path from 'path';
import config from 'config';
import { Token } from '../src/entities/Token';

// GENERAL SETTINGS
const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const profileDirectory = path.join('.', uploadDir, profileDir);
beforeAll(async () => {
  await db.initialize();
});
beforeEach(async () => {
  await db.manager.delete(Token, {});
  await db.manager.delete(User, {});
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
const putUser = async (
  id = 5,
  body = {},
  options: {
    auth?: {
      email: string;
      password: string;
    };
    language?: string;
    token?: string;
  } = {}
) => {
  let token: string | undefined = undefined;
  if (options.auth) {
    const res = (await request(app).post('/api/1.0/auth').send(options.auth)) as unknown as Record<
      string,
      Record<string, unknown>
    >;
    token = res.body.token as string;
  }

  const agent = request(app).put('/api/1.0/users/' + id.toString());
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  if (token) {
    void agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    void agent.set('Authorization', `Bearer ${options.token}`);
  }
  const res = (await agent.send(body)) as unknown as Record<string, Record<string, unknown>>;
  return res;
};

const readFileAsBase64 = (file = 'test-png.png') => {
  const filePath = path.join('.', '__tests__', 'resources', file);
  return fs.readFileSync(filePath, { encoding: 'base64' });
};

describe('User Update', () => {
  it('returns forbidden when request sent without basic authorization', async () => {
    const res = await putUser();
    expect(res.status).toBe(403);
  });

  it.each`
    language | message
    ${'es'}  | ${es.unauthorized_user_update}
    ${'en'}  | ${en.unauthorized_user_update}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async (params: { language: string; message: string }) => {
      const nowInMillis = new Date().getTime();
      const res = await putUser(5, {}, { language: params.language });
      expect(res.body.path).toBe('/api/1.0/users/5');
      expect(res.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(res.body.message).toBe(params.message);
    }
  );

  it('returns forbidden when request send with incorrect email in basic authorization', async () => {
    await addUser();
    const res = await putUser(
      5,
      {},
      {
        auth: {
          email: 'user100@email.com',
          password: 'P4ssword',
        },
      }
    );
    expect(res.status).toBe(403);
  });

  it('returns forbidden when request send with incorrect password in basic authorization', async () => {
    await addUser();
    const res = await putUser(
      5,
      {},
      {
        auth: {
          email: 'user1@email.com',
          password: 'password',
        },
      }
    );
    expect(res.status).toBe(403);
  });

  it('returns forbidden when update request is sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeUpdated = await addUser({ ...activeUser, username: 'user2', email: 'user2@email.com' });
    const res = await putUser(
      userToBeUpdated.id,
      {},
      {
        auth: {
          email: 'user1@email.com',
          password: 'P4ssword',
        },
      }
    );
    expect(res.status).toBe(403);
  });

  it('returns forbidden when update request is sent by inactive user with correct credentials for its own user', async () => {
    const inactiveUser = await addUser({ ...activeUser, inactive: true });
    const res = await putUser(
      inactiveUser.id,
      {},
      {
        auth: {
          email: 'user1@email.com',
          password: 'P4ssword',
        },
      }
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 ok when valid update request sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
    };
    const res = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    expect(res.status).toBe(200);
  });

  it('updates username in database when valid update request is sent from authorized user', async () => {
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
    };
    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    const inDBUser = await db.manager.findOne(User, {
      where: {
        id: savedUser.id,
      },
    });
    expect(inDBUser).not.toBeNull();
    expect((inDBUser as User).username).toBe(validUpdate.username);
  });

  it('returns 403 when token is not valid', async () => {
    const res = await putUser(5, {}, { token: '123' });
    expect(res.status).toBe(403);
  });

  it('saves the user image when update contains image as base64', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
      image: fileInBase64,
    };
    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    const inDBUser = await db.manager.findOne(User, {
      where: {
        id: savedUser.id,
      },
    });
    expect(inDBUser).not.toBe(null);
    expect((inDBUser as User).image).toBeTruthy();
  });

  it('returns success body having only id, username, email and image', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
      image: fileInBase64,
    };
    const res = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    expect(Object.keys(res.body)).toEqual(['id', 'username', 'email', 'image']);
  });

  it('saves the user image to upload folder and stores filename in user when update has image', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
      image: fileInBase64,
    };
    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    const inDBUser = await db.manager.findOne(User, {
      where: {
        id: savedUser.id,
      },
    });
    expect(inDBUser).not.toBeNull();
    const profileImagePath = path.join(profileDirectory, (inDBUser as User).image as string);
    expect(fs.existsSync(profileImagePath)).toBe(true);
  });

  it('removes the old image after user upload new one', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
      image: fileInBase64,
    };
    const res = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    const { image } = res.body as { image: string };
    const firstImage = image;

    await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });

    const profileImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImagePath)).toBe(false);
  });

  it.each`
    language | value             | message
    ${'en'}  | ${null}           | ${en.username_null}
    ${'en'}  | ${'usr'}          | ${en.username_size}
    ${'en'}  | ${'a'.repeat(33)} | ${en.username_size}
    ${'es'}  | ${null}           | ${es.username_null}
    ${'es'}  | ${'usr'}          | ${es.username_size}
    ${'es'}  | ${'a'.repeat(33)} | ${es.username_size}
  `(
    'return bad request with $message when username is updated with $value when language is set as $language',
    async (params: { language: string; value: string | null; message: string }) => {
      const savedUser = await addUser();
      const invalidUpdate = {
        username: params.value,
      };
      const res = await putUser(savedUser.id, invalidUpdate, {
        auth: {
          email: savedUser.email,
          password: 'P4ssword',
        },
        language: params.language,
      });
      const validationErrors = res.body.validationErrors as Record<string, unknown>;
      expect(res.status).toBe(400);
      expect(validationErrors.username).toBe(params.message);
    }
  );

  it('returns 200 when image size is exactly 2mb', async () => {
    const testPNG = readFileAsBase64();
    const pngByte = Buffer.from(testPNG, 'base64').length;
    const twoMB = 1024 * 1024 * 2;
    const filling = 'a'.repeat(twoMB - pngByte);
    const fillBase64 = Buffer.from(filling).toString('base64');
    const savedUser = await addUser();
    const validUpdate = {
      username: 'updated-user',
      image: testPNG + fillBase64,
    };
    const res = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    expect(res.status).toBe(200);
  });

  it('returns 400 when image size exceeds 2mb', async () => {
    const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
    const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
    const savedUser = await addUser();
    const invalidUpdate = {
      username: 'updated-user',
      image: base64,
    };
    const res = await putUser(savedUser.id, invalidUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    expect(res.status).toBe(400);
  });

  it('keeps the old image after user only update username', async () => {
    const fileInBase64 = readFileAsBase64();
    const savedUser = await addUser();
    const validUpdate = {
      username: 'user1-updated',
      image: fileInBase64,
    };
    const res = await putUser(savedUser.id, validUpdate, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    const { image } = res.body as { image: string };
    const firstImage = image;

    await putUser(
      savedUser.id,
      { username: 'user1-updated2' },
      {
        auth: {
          email: savedUser.email,
          password: 'P4ssword',
        },
      }
    );

    const profileImagePath = path.join(profileDirectory, firstImage);
    expect(fs.existsSync(profileImagePath)).toBe(true);

    const userInDB = await db.manager.findOne(User, {
      where: {
        id: savedUser.id,
      },
    });
    expect(userInDB !== null ? userInDB.image : '').toBe(firstImage);
  });

  it.each`
    language | message
    ${'es'}  | ${es.profile_image_size}
    ${'en'}  | ${en.profile_image_size}
  `(
    'returns $message whe file size exceeds 2mb and language is $language',
    async (params: { language: string; message: string }) => {
      const fileWithExceeding2MB = 'a'.repeat(1024 * 1024 * 2) + 'a';
      const base64 = Buffer.from(fileWithExceeding2MB).toString('base64');
      const savedUser = await addUser();
      const invalidUpdate = {
        username: 'updated-user',
        image: base64,
      };
      const res = await putUser(savedUser.id, invalidUpdate, {
        auth: {
          email: savedUser.email,
          password: 'P4ssword',
        },
        language: params.language,
      });
      const validationErrors = res.body.validationErrors as Record<string, unknown>;
      expect(validationErrors.image).toBe(params.message);
    }
  );

  it.each`
    file              | status
    ${'test-gif.gif'} | ${400}
    ${'test-pdf.pdf'} | ${400}
    ${'test-txt.txt'} | ${400}
    ${'test-png.png'} | ${200}
    ${'test-jpg.jpg'} | ${200}
  `('returns $status when uploading $file as image', async (params: { file: string; status: number }) => {
    const fileInBase64 = readFileAsBase64(params.file);
    const savedUser = await addUser();
    const updateBody = {
      username: 'user1-updated',
      image: fileInBase64,
    };
    const res = await putUser(savedUser.id, updateBody, {
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    expect(res.status).toBe(params.status);
  });

  it.each`
    file              | language | message
    ${'test-gif.gif'} | ${'es'}  | ${es.unsupported_image_file}
    ${'test-gif.gif'} | ${'en'}  | ${en.unsupported_image_file}
    ${'test-pdf.pdf'} | ${'es'}  | ${es.unsupported_image_file}
    ${'test-pdf.pdf'} | ${'en'}  | ${en.unsupported_image_file}
    ${'test-txt.txt'} | ${'es'}  | ${es.unsupported_image_file}
    ${'test-txt.txt'} | ${'en'}  | ${en.unsupported_image_file}
  `(
    'returns $message when uploading $file as image when language is $language',
    async (params: { file: string; language: string; message: string }) => {
      const fileInBase64 = readFileAsBase64(params.file);
      const savedUser = await addUser();
      const updateBody = {
        username: 'user1-updated',
        image: fileInBase64,
      };
      const res = await putUser(savedUser.id, updateBody, {
        auth: {
          email: savedUser.email,
          password: 'P4ssword',
        },
        language: params.language,
      });
      const validationErrors = res.body.validationErrors as Record<string, unknown>;
      expect(validationErrors.image).toBe(params.message);
    }
  );
});
