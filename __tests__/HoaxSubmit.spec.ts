import request from 'supertest';
import app from '../src/app';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import bcrypt from 'bcrypt';
import { Hoax } from '../src/entities/Hoax';
import { DynamicTestInterface, ErrorInterface, OptionInterface, Response } from './definitions/custom';

// SETTINGS
const activeUser = {
  username: 'user1',
  email: 'user1@email.com',
  password: 'P4ssword',
  inactive: false,
};

const credentials = {
  email: 'user1@email.com',
  password: 'P4ssword',
};

const addUser = async (user = { ...activeUser }) => {
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  return db.manager.save(User, user);
};

const postHoax = async (body: object = {}, options: OptionInterface = {}) => {
  let token: string | undefined = undefined;
  if (options.auth) {
    const res: Response<RespBodyInterface & ErrorInterface<Hoax>> = await request(app)
      .post('/api/1.0/auth')
      .send(options.auth);
    token = res.body.token;
  }

  const agent = request(app).post('/api/1.0/hoaxes');
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  if (token) {
    void agent.set('Authorization', `Bearer ${token}`);
  }
  if (options.token) {
    void agent.set('Authorization', `Bearer ${options.token}`);
  }
  const res: Response<RespBodyInterface & ErrorInterface<Hoax>> = await agent.send(body);
  return res;
};

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
describe('Post Hoax', () => {
  it('returns 401 when post has no authentication', async () => {
    const res = await postHoax();
    expect(res.status).toBe(401);
  });

  it.each`
    language | message
    ${'es'}  | ${es.unauthorized_hoax_submit}
    ${'en'}  | ${en.unauthorized_hoax_submit}
  `(
    'returns error body with $message when unauthorized request sent with language as $language',
    async ({ language, message }: DynamicTestInterface) => {
      const nowInMillis = Date.now();
      const res = await postHoax({}, { language });
      const error = res.body;
      expect(error.path).toBe('/api/1.0/hoaxes');
      expect(error.message).toBe(message);
      expect(error.timestamp).toBeGreaterThan(nowInMillis);
    }
  );

  it('returns 200 when valid hoax submited with authorized user', async () => {
    await addUser();
    const res = await postHoax({ content: 'Hoax content' }, { auth: credentials });
    expect(res.status).toBe(200);
  });

  it('saves the hoax to database when authorized user sends valid request', async () => {
    await addUser();
    await postHoax({ content: 'Hoax content' }, { auth: credentials });
    const hoaxes = await db.manager.find(Hoax);
    expect(hoaxes.length).toBe(1);
  });

  it('saves the hoax content and timestamp to database', async () => {
    await addUser();
    const beforeSubmit = Date.now();
    await postHoax({ content: 'Hoax content' }, { auth: credentials });
    const hoaxes = await db.manager.find(Hoax);
    const savedHoax = hoaxes[0];
    expect(savedHoax.content).toBe('Hoax content');
    expect(savedHoax.timestamp).toBeGreaterThan(beforeSubmit);
    expect(savedHoax.timestamp).toBeLessThan(Date.now());
  });

  it.each`
    language | message
    ${'es'}  | ${es.hoax_submit_sucess}
    ${'en'}  | ${en.hoax_submit_sucess}
  `(
    'returns $message to success submit when language as $language',
    async ({ language, message }: DynamicTestInterface) => {
      await addUser();
      const res = await postHoax({ content: 'Hoax content' }, { auth: credentials, language });
      expect(res.body.message).toBe(message);
    }
  );

  it.each`
    language | message
    ${'es'}  | ${es.validation_failure}
    ${'en'}  | ${en.validation_failure}
  `(
    'returns 400 and $message when the hoax content is less than 10 characters and language is $language',
    async ({ language, message }: DynamicTestInterface) => {
      await addUser();
      const res = await postHoax({ content: '123456789' }, { auth: credentials, language });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(message);
    }
  );

  it('returns validation error body when an invalid hoax post by authorized user', async () => {
    await addUser();
    const nowInMillis = Date.now();
    const res = await postHoax({ content: '123456789' }, { auth: credentials });
    const error = res.body;
    expect(error.timestamp).toBeGreaterThan(nowInMillis);
    expect(error.path).toBe('/api/1.0/hoaxes');
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message', 'validationErrors']);
  });

  it.each`
    language | content             | description | message
    ${'es'}  | ${null}             | ${'null'}   | ${es.hoax_content_size}
    ${'es'}  | ${'a'.repeat(9)}    | ${'short'}  | ${es.hoax_content_size}
    ${'es'}  | ${'a'.repeat(5001)} | ${'long'}   | ${es.hoax_content_size}
    ${'en'}  | ${null}             | ${'null'}   | ${en.hoax_content_size}
    ${'en'}  | ${'a'.repeat(9)}    | ${'short'}  | ${en.hoax_content_size}
    ${'en'}  | ${'a'.repeat(5001)} | ${'long'}   | ${en.hoax_content_size}
  `(
    'returns $message when the content is $description and language is $language',
    async ({ language, content, message }: DynamicTestInterface & { content: string }) => {
      await addUser();
      const res = await postHoax({ content }, { auth: credentials, language });
      expect(res.body.validationErrors.content).toBe(message);
    }
  );

  it('stores hoax owner id in database', async () => {
    const user = await addUser();
    await postHoax({ content: 'Hoax content' }, { auth: credentials });
    const hoaxes = await db.manager.find(Hoax);
    const hoax = hoaxes[0];
    expect(hoax.userId).toBe(user.id);
  });
});

// DEFINITIONS
interface RespBodyInterface {
  token?: string;
}
