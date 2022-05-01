import request from 'supertest';
import app from '../src/app';
import { User } from '../src/entities/User';
import { Hoax } from '../src/entities/Hoax';
import db from '../database/dataSource';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import { DynamicTestInterface, ErrorInterface, OptionInterface, Response } from './definitions/custom';

// SETTINGS
beforeAll(async () => {
  await db.initialize();
});
beforeEach(async () => {
  await db.manager.delete(Hoax, {});
  await db.manager.delete(User, {});
});
afterAll(async () => {
  await db.destroy();
});

// TESTS
describe('Listing All Hoaxes', () => {
  const addHoaxes = async (count: number) => {
    for (let i = 0; i < count; i++) {
      const res = await db.manager.insert(User, {
        username: `user${i + 1}`,
        email: `user${i + 1}@email.com`,
      });
      await db.manager.insert(Hoax, {
        content: `hoax content ${i + 1}`,
        timestamp: i,
        userId: res.raw as number,
      });
    }
  };

  const getHoaxes = async () => {
    const res: Response<HoaxesPageInterface<Hoax[]>> = await request(app).get('/api/1.0/hoaxes');
    return res;
  };

  it('returns 200 ok when there are no hoaxes in database', async () => {
    const res = await getHoaxes();
    expect(res.status).toBe(200);
  });

  it('returns page object as response body', async () => {
    const res = await getHoaxes();
    expect(res.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 hoaxes in page content when there are 11 users in database', async () => {
    await addHoaxes(11);
    const res = await getHoaxes();
    expect(res.body.content.length).toBe(10);
  });

  it('returns only id, content. timestamp and user object having id, username, email and image in content array for each hoax', async () => {
    await addHoaxes(11);
    const res = await getHoaxes();
    const hoax = res.body.content[0];
    const hoaxKeys = Object.keys(hoax);
    const userKeys = Object.keys(hoax.user);
    expect(hoaxKeys).toEqual(['id', 'content', 'timestamp', 'user']);
    expect(userKeys).toEqual(['id', 'username', 'email', 'image']);
  });

  it('returns 2 as totalPages when there are 11 hoaxes', async () => {
    await addHoaxes(11);
    const res = await getHoaxes();
    expect(res.body.totalPages).toBe(2);
  });

  it('returns second page hoaxes and page indicator when page is set as 1 in request parameter', async () => {
    await addHoaxes(11);
    const res: Response<HoaxesPageInterface<Hoax[]>> = await request(app).get('/api/1.0/hoaxes?page=1');
    const hoax = res.body.content[0];
    expect(hoax.content).toBe('hoax content 1');
    expect(res.body.page).toBe(1);
  });

  it('returns first page when page is below zero as request parameter', async () => {
    await addHoaxes(11);
    const res: Response<HoaxesPageInterface<Hoax[]>> = await request(app).get('/api/1.0/hoaxes').query({ page: -5 });
    expect(res.body.page).toBe(0);
  });

  it('returns 5 hoaxes and corresponding size indicator when size is set as 5 in request parameter', async () => {
    await addHoaxes(11);
    const res: Response<HoaxesPageInterface<Hoax[]>> = await request(app).get('/api/1.0/hoaxes').query({ size: 5 });
    expect(res.body.content.length).toBe(5);
    expect(res.body.size).toBe(5);
  });

  it('returns 10 hoaxes and corresponding size indicator when size is set as 1000', async () => {
    await addHoaxes(11);
    const res: Response<HoaxesPageInterface<Hoax[]>> = await request(app).get('/api/1.0/hoaxes').query({ size: 1000 });
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it('returns 10 hoaxes and corresponding size indicator when size is set as 0', async () => {
    await addHoaxes(11);
    const res: Response<HoaxesPageInterface<Hoax[]>> = await request(app).get('/api/1.0/hoaxes').query({ size: 0 });
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it('returns page as zero and size as 10 when non numeric query params provided for both', async () => {
    await addHoaxes(11);
    const res: Response<HoaxesPageInterface<Hoax[]>> = await request(app)
      .get('/api/1.0/hoaxes')
      .query({ page: 'page', size: 'size' });
    expect(res.body.page).toBe(0);
    expect(res.body.size).toBe(10);
  });

  it('return hoaxes to be ordered from new to old', async () => {
    await addHoaxes(11);
    const res = await getHoaxes();
    const firstHoax = res.body.content[0];
    const lastHoax = res.body.content[9];
    expect(firstHoax.timestamp).toBeGreaterThan(lastHoax.timestamp);
  });
});

describe('Listing Hoaxes of User', () => {
  const addUser = async (name = 'user1') => {
    const res = await db.manager.insert(User, {
      username: name,
      email: `${name}@email.com`,
    });
    return res.raw as number;
  };

  const addHoaxes = async (count: number, userId: number) => {
    for (let i = 0; i < count; i++) {
      await db.manager.insert(Hoax, {
        content: `hoax content ${i + 1}`,
        timestamp: i,
        userId,
      });
    }
  };

  const getHoaxes = async (id: number, options: OptionInterface = {}) => {
    const agent = request(app).get(`/api/1.0/users/${id}/hoaxes`);
    if (options.language) {
      void agent.set('Accept-Language', options.language);
    }
    if (options.query) {
      void agent.query(options.query);
    }
    const res: Response<HoaxesPageInterface<Hoax[]> & ErrorInterface<User>> = await agent.send();
    return res;
  };

  it('returns 200 ok when there are no hoaxes in database', async () => {
    const userId = await addUser();
    const res = await getHoaxes(userId);
    expect(res.status).toBe(200);
  });

  it('returns 404 when user does not exist', async () => {
    const res = await getHoaxes(5);
    expect(res.status).toBe(404);
  });

  it.each`
    language | message
    ${'es'}  | ${es.user_not_found}
    ${'en'}  | ${en.user_not_found}
  `(
    'returns error object with $message for unknown user when language is $language',
    async ({ language, message }: DynamicTestInterface) => {
      const nowInMillis = Date.now();
      const res = await getHoaxes(5, { language });
      const error = res.body;
      expect(error.message).toBe(message);
      expect(error.path).toBe('/api/1.0/users/5/hoaxes');
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it('returns page object as response body', async () => {
    const userId = await addUser();
    const res = await getHoaxes(userId);
    expect(res.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 hoaxes in page content when there are 11 users in database', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId);
    expect(res.body.content.length).toBe(10);
  });

  it('returns 5 hoaxes belong to user in page content when there are total 11 hoaxes', async () => {
    const userId = await addUser();
    await addHoaxes(5, userId);
    const userId2 = await addUser('user2');
    await addHoaxes(6, userId2);
    const res = await getHoaxes(userId);
    expect(res.body.content.length).toBe(5);
  });

  it('returns only id, content. timestamp and user object having id, username, email and image in content array for each hoax', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId);
    const hoax = res.body.content[0];
    const hoaxKeys = Object.keys(hoax);
    const userKeys = Object.keys(hoax.user);
    expect(hoaxKeys).toEqual(['id', 'content', 'timestamp', 'user']);
    expect(userKeys).toEqual(['id', 'username', 'email', 'image']);
  });

  it('returns 2 as totalPages when there are 11 hoaxes', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId);
    expect(res.body.totalPages).toBe(2);
  });

  it('returns second page hoaxes and page indicator when page is set as 1 in request parameter', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId, { query: { page: 1 } });
    const hoax = res.body.content[0];
    expect(hoax.content).toBe('hoax content 1');
    expect(res.body.page).toBe(1);
  });

  it('returns first page when page is below zero as request parameter', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId, { query: { page: -5 } });
    expect(res.body.page).toBe(0);
  });

  it('returns 5 hoaxes and corresponding size indicator when size is set as 5 in request parameter', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId, { query: { size: 5 } });
    expect(res.body.content.length).toBe(5);
    expect(res.body.size).toBe(5);
  });

  it('returns 10 hoaxes and corresponding size indicator when size is set as 1000', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId, { query: { size: 1000 } });
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it('returns 10 hoaxes and corresponding size indicator when size is set as 0', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId, { query: { size: 0 } });
    expect(res.body.content.length).toBe(10);
    expect(res.body.size).toBe(10);
  });

  it('returns page as zero and size as 10 when non numeric query params provided for both', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId, { query: { page: 'page', size: 'size' } });
    expect(res.body.page).toBe(0);
    expect(res.body.size).toBe(10);
  });

  it('return hoaxes to be ordered from new to old', async () => {
    const userId = await addUser();
    await addHoaxes(11, userId);
    const res = await getHoaxes(userId);
    const firstHoax = res.body.content[0];
    const lastHoax = res.body.content[9];
    expect(firstHoax.timestamp).toBeGreaterThan(lastHoax.timestamp);
  });
});

// DEFINITIONS
interface HoaxesPageInterface<T> {
  content: T;
  page: number;
  size: number;
  totalPages: number;
}
