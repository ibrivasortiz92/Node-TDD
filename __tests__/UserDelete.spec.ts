import request from 'supertest';
import app from '../src/app';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import { Token } from '../src/entities/Token';
import bcrypt from 'bcrypt';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import { Hoax } from '../src/entities/Hoax';

// GENERAL SETTINGS
beforeAll(async () => {
  jest.setTimeout(15000);
  await db.initialize();
});
beforeEach(async () => {
  await db.manager.delete(Hoax, {});
  await db.manager.delete(Token, {});
  await db.manager.delete(User, {});
});
afterAll(async () => {
  jest.setTimeout(5000);
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
const auth = async (
  options = {
    auth: {
      email: 'user1@email.com',
      password: 'P4ssword',
    },
  }
) => {
  const res = (await request(app).post('/api/1.0/auth').send(options.auth)) as unknown as Record<
    string,
    Record<string, unknown>
  >;

  return res.body.token as string;
};
const deleteUser = async (id = 5, options: { language?: string; token?: string } = {}) => {
  const agent = request(app).delete('/api/1.0/users/' + id.toString());
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  if (options.token) {
    void agent.set('Authorization', `Bearer ${options.token}`);
  }
  const res = (await agent.send()) as unknown as Record<string, Record<string, unknown>>;
  return res;
};

describe('User Delete', () => {
  it('returns forbidden when request sent unauthorized', async () => {
    const res = await deleteUser();
    expect(res.status).toBe(403);
  });

  it.each`
    language | message
    ${'es'}  | ${es.unauthorized_user_delete}
    ${'en'}  | ${en.unauthorized_user_delete}
  `(
    'returns error body with $message for unauthorized request when language is $language',
    async (params: { language: string; message: string }) => {
      const nowInMillis = new Date().getTime();
      const res = await deleteUser(5, { language: params.language });
      expect(res.body.path).toBe('/api/1.0/users/5');
      expect(res.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(res.body.message).toBe(params.message);
    }
  );

  it('returns forbidden when delete request is sent with correct credentials but for different user', async () => {
    await addUser();
    const userToBeDelete = await addUser({ ...activeUser, username: 'user2', email: 'user2@email.com' });
    const token = await auth({
      auth: {
        email: 'user1@email.com',
        password: 'P4ssword',
      },
    });
    const res = await deleteUser(userToBeDelete.id, {
      token: token,
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 when token is not valid', async () => {
    const res = await deleteUser(5, { token: '123' });
    expect(res.status).toBe(403);
  });

  it('returns 200 ok when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: {
        email: 'user1@email.com',
        password: 'P4ssword',
      },
    });
    const res = await deleteUser(savedUser.id, {
      token: token,
    });
    expect(res.status).toBe(200);
  });

  it('deletes user from database when request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    await deleteUser(savedUser.id, {
      token: token,
    });

    const inDBUser = await db.manager.findOne(User, {
      where: {
        id: savedUser.id,
      },
    });
    expect(inDBUser).toBeNull();
  });

  it('deletes token from database when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    await deleteUser(savedUser.id, {
      token: token,
    });

    const tokenInDB = await db.manager.findOne(Token, {
      where: {
        token: token,
      },
    });
    expect(tokenInDB).toBeNull();
  });

  it('deletes all tokens from database when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token1 = await auth({
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    const token2 = await auth({
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });
    await deleteUser(savedUser.id, {
      token: token1,
    });

    const tokenInDB = await db.manager.findOne(Token, {
      where: {
        token: token2,
      },
    });
    expect(tokenInDB).toBeNull();
  });

  it('deletes hoaxes from database when delete request sent from authorized user', async () => {
    const savedUser = await addUser();
    const token = await auth({
      auth: {
        email: savedUser.email,
        password: 'P4ssword',
      },
    });

    await request(app).post('/api/1.0/hoaxes').set('Authorization', `Bearer ${token}`).send({
      content: 'Hoax content',
    });

    await deleteUser(savedUser.id, {
      token: token,
    });

    const hoaxes = await db.manager.find(Hoax);
    expect(hoaxes.length).toBe(0);
  });
});
