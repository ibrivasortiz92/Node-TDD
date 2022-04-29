import request from 'supertest';
import app from '../src/app';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import bcrypt from 'bcrypt';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import { Token } from '../src/entities/Token';

// GENERAL SETTINGS
beforeAll(async () => {
  jest.setTimeout(15000);
  await db.initialize();
});
beforeEach(async () => {
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
const postAuthentication = async (
  credentials: { email?: string; password?: string },
  options?: { language: string }
) => {
  const agent = request(app).post('/api/1.0/auth');
  if (options) {
    void agent.set('Accept-Language', options.language);
  }
  const res = (await agent.send(credentials)) as unknown as Record<string, Record<string, unknown>>;
  return res;
};
const postLogout = async (options: { token?: string } = {}) => {
  const agent = request(app).post('/api/1.0/logout');
  if (options.token) {
    void agent.set('Authorization', `Bearer ${options.token}`);
  }
  const res = (await agent.send()) as unknown as Record<string, Record<string, unknown>>;
  return res;
};

// TESTS SUITES
describe('Authentication', () => {
  it('returns 200 when credentials are correct', async () => {
    await addUser();
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    expect(res.status).toBe(200);
  });

  it('returns only user id, username, image and token when login success', async () => {
    const user = await addUser();
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe(user.username);
    expect(Object.keys(res.body)).toEqual(['id', 'username', 'image', 'token']);
  });

  it('returns 401 when user does not exist', async () => {
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    expect(res.status).toBe(401);
  });

  it('return proper error body when authentication fails', async () => {
    const nowInMillis = new Date().getTime();
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    const error = res.body;
    expect(error.path).toBe('/api/1.0/auth');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it.each`
    language | message
    ${'es'}  | ${es.authentication_failure}
    ${'en'}  | ${en.authentication_failure}
  `(
    'returns $message when authentication fails and language is set as $language',
    async (params: { language: string; message: string }) => {
      const res = await postAuthentication(
        {
          email: 'user1@email.com',
          password: 'P4ssword',
        },
        { language: params.language }
      );
      expect(res.body.message).toBe(params.message);
    }
  );

  it('returns 401 when password is wrong', async () => {
    await addUser();
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'password',
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when logging in with inactive account', async () => {
    await addUser({
      ...activeUser,
      inactive: true,
    });
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    expect(res.status).toBe(403);
  });

  it('return proper error body when inactive authentication fails', async () => {
    await addUser({
      ...activeUser,
      inactive: true,
    });
    const nowInMillis = new Date().getTime();
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    const error = res.body;
    expect(error.path).toBe('/api/1.0/auth');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it.each`
    language | message
    ${'es'}  | ${es.inactive_authentication_failure}
    ${'en'}  | ${en.inactive_authentication_failure}
  `(
    'returns $message when authentication fails for inactive account and language is set as $language',
    async (params: { language: string; message: string }) => {
      await addUser({
        ...activeUser,
        inactive: true,
      });
      const res = await postAuthentication(
        {
          email: 'user1@email.com',
          password: 'P4ssword',
        },
        { language: params.language }
      );
      expect(res.body.message).toBe(params.message);
    }
  );

  it('returns 401 when e-mail is not valid', async () => {
    const res = await postAuthentication({
      password: 'P4ssword',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 when password is not valid', async () => {
    const res = await postAuthentication({
      email: 'user1@email.com',
    });
    expect(res.status).toBe(401);
  });

  it('returns token in response body when credentials are correct', async () => {
    await addUser();
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    expect(res.body.token).not.toBeUndefined();
  });
});

describe('Logout', () => {
  it('returns 200 ok when unauthorized request send for logout', async () => {
    const res = await postLogout();
    expect(res.status).toBe(200);
  });

  it('removes the token from database', async () => {
    await addUser();
    const res = await postAuthentication({
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    const token = res.body.token as string;
    await postLogout({ token: token });
    const storedToken = await db.manager.findOne(Token, {
      where: {
        token: token,
      },
    });
    expect(storedToken).toBeNull();
  });
});

describe('Token Expiration', () => {
  const putUser = async (id = 5, body: { [key: string]: string } = {}, options: { token?: string } = {}) => {
    const agent = request(app).put('/api/1.0/users/' + id.toString());
    if (options.token) {
      void agent.set('Authorization', `Bearer ${options.token}`);
    }
    const res = (await agent.send(body)) as unknown as Record<string, Record<string, unknown>>;
    return res;
  };

  it('returns 403 when token is older than 1 week', async () => {
    const savedUser = await addUser();
    const token = 'test-token';
    const oneWeekAgo = (Date.now() - 7 * 24 * 60 * 60 * 1000 - 1).toString();
    const storedToken = db.manager.create(Token, {
      token: token,
      userId: savedUser.id,
      lastUsedAt: oneWeekAgo,
    });
    await db.manager.save(Token, storedToken);
    const validUpdate = { username: 'user1-updated' };
    const res = await putUser(savedUser.id, validUpdate, {
      token: token,
    });
    expect(res.status).toBe(403);
  });

  it('refreshes lastUsedAt when unexpired token is used', async () => {
    const savedUser = await addUser();
    const token = 'test-token';
    const fourDaysAgo = (Date.now() - 4 * 24 * 60 * 60 * 1000).toString();
    const storedToken = db.manager.create(Token, {
      token: token,
      userId: savedUser.id,
      lastUsedAt: fourDaysAgo,
    });
    await db.manager.save(storedToken);
    const validUpdate = { username: 'user1-updated' };
    const rightBeforeSendingRequest = Date.now();
    await putUser(savedUser.id, validUpdate, {
      token: token,
    });
    const updatedToken = await db.manager.findOne(Token, {
      where: {
        token: token,
      },
    });
    expect(updatedToken).not.toBeNull();
    expect(Number.parseInt((updatedToken as Token).lastUsedAt)).toBeGreaterThan(rightBeforeSendingRequest);
  });

  it('refreshes lastUsedAt when unexpired token is used for unauthenticated endpoint', async () => {
    const savedUser = await addUser();
    const token = 'test-token';
    const fourDaysAgo = (Date.now() - 4 * 24 * 60 * 60 * 1000).toString();
    const storedToken = db.manager.create(Token, {
      token: token,
      userId: savedUser.id,
      lastUsedAt: fourDaysAgo,
    });
    await db.manager.save(storedToken);
    const rightBeforeSendingRequest = Date.now();
    await request(app).get('/api/1.0/users/5').set('Authorization', `Bearer ${token}`);
    const updatedToken = await db.manager.findOne(Token, {
      where: {
        token: token,
      },
    });
    expect(updatedToken).not.toBeNull();
    expect(Number.parseInt((updatedToken as Token).lastUsedAt)).toBeGreaterThan(rightBeforeSendingRequest);
  });
});
