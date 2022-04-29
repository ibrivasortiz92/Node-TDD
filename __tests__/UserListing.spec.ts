import request from 'supertest';
import app from '../src/app';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import bcrypt from 'bcrypt';
import { Token } from '../src/entities/Token';

// GLOBAL SETTINGS
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

const getUsers = (options: { token?: string } = {}) => {
  const agent = request(app).get('/api/1.0/users');
  if (options.token) {
    void agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent;
};
const addUsers = async (activeUserCount: number, inactiveUserCount = 0) => {
  const hash = await bcrypt.hash('P4ssword', 10);
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    const user = db.manager.create(User, {
      username: `user${i + 1}`,
      email: `user${i + 1}@email.com`,
      password: hash,
      inactive: i >= activeUserCount,
    });
    await db.manager.save(user);
  }
};

// TESTS SUITES
describe('Listing Users', () => {
  it('returns 200 ok when there are no user in database', async () => {
    const res = await getUsers();
    expect(res.status).toBe(200);
  });

  it('returns page object as response body', async () => {
    const res = await getUsers();
    expect(res.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 users in page content when there are 11 users in database', async () => {
    await addUsers(11);
    const res = (await getUsers()) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    expect(res.body.content.length).toBe(10);
  });

  it('returns 6 users in page content when there are active 6 users and inactive 5 users in database', async () => {
    await addUsers(6, 5);
    const res = (await getUsers()) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    expect(res.body.content.length).toBe(6);
  });

  it('returns only id, username, email and image in content array for each user', async () => {
    await addUsers(11);
    const res = (await getUsers()) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    const user = res.body.content[0] as object[];
    expect(Object.keys(user)).toEqual(['id', 'username', 'email', 'image']);
  });

  it('returns 2 as totalPages when there are 15 active and 7 inactive users', async () => {
    await addUsers(15, 7);
    const res = (await getUsers()) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    expect(res.body.totalPages).toBe(2);
  });

  it('returns second page users and page indicator when page is set as 1 in request parameter', async () => {
    await addUsers(11);
    const res = (await request(app).get('/api/1.0/users?page=1')) as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    const user = res.body.content[0] as User;
    expect(user.username).toBe('user11');
    expect(res.body.page).toBe(1);
  });

  it('returns first page when page is below zero as request parameter', async () => {
    await addUsers(11);
    const res = (await request(app).get('/api/1.0/users').query({ page: -5 })) as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(res.body.page).toBe(0);
  });

  it('returns 5 users and corresponding size indicator when size is set as 5 in request parameter', async () => {
    await addUsers(11);
    const res = (await getUsers().query({ size: 5 })) as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(res.body.content.length).toBe(5);
    expect(res.body.size).toBe(5);
  });

  it('returns 10 users and corresponding size indicator when size is set as 1000', async () => {
    await addUsers(11);
    const res = (await getUsers().query({ size: 1000 })) as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it('returns 10 users and corresponding size indicator when size is set as 0', async () => {
    await addUsers(11);
    const res = (await getUsers().query({ size: 0 })) as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it('returns page as zero and size as 10 when non numeric query params provided for both', async () => {
    await addUsers(11);
    const res = (await getUsers().query({ page: 'page', size: 'size' })) as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(res.body.page).toBe(0);
    expect(res.body.size).toBe(10);
  });

  it('returns user page without logged in user when request has valid authorization', async () => {
    await addUsers(11);
    const token = await auth({
      auth: {
        email: 'user1@email.com',
        password: 'P4ssword',
      },
    });
    const res = (await getUsers({ token: token })) as unknown as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(res.body.totalPages).toBe(1);
  });
});

describe('Get User', () => {
  const getUser = (id = 5) => {
    return request(app).get('/api/1.0/users/' + id.toString());
  };
  it('return 404 when user not found', async () => {
    const res = await getUser();
    expect(res.status).toBe(404);
  });

  it.each`
    language | message
    ${'es'}  | ${es.user_not_found}
    ${'en'}  | ${en.user_not_found}
  `(
    'returns $message for unknown user when language is set to $language',
    async (params: { language: string; message: string }) => {
      const res = (await getUser().set('Accept-Language', params.language)) as unknown as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
      expect(res.body.message).toBe(params.message);
    }
  );

  it('returns proper error body when user not found', async () => {
    const nowInMillis = new Date().getTime();
    const res = (await getUser()) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    const error = res.body;
    expect(error.path).toBe('/api/1.0/users/5');
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });

  it('returns 200 ok when an active user exist', async () => {
    const user = db.manager.create(User, {
      username: 'user1',
      email: 'user1@email.com',
      password: 'P4ssword',
      inactive: false,
    });
    await db.manager.save(user);
    const res = await getUser(user.id);
    expect(res.status).toBe(200);
  });

  it('returns id, username, email and image in response body when an active user exist', async () => {
    const user = db.manager.create(User, {
      username: 'user1',
      email: 'user1@email.com',
      password: 'P4ssword',
      inactive: false,
    });
    await db.manager.save(user);
    const res = (await getUser(user.id)) as unknown as Record<string, Record<string, Record<string, unknown>>>;
    expect(Object.keys(res.body)).toEqual(['id', 'username', 'email', 'image']);
  });

  it('returns 404 when the user is inactive', async () => {
    const user = db.manager.create(User, {
      username: 'user1',
      email: 'user1@email.com',
      password: 'P4ssword',
      inactive: true,
    });
    await db.manager.save(user);
    const res = await getUser(user.id);
    expect(res.status).toBe(404);
  });
});
