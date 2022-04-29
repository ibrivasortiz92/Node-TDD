import request from 'supertest';
import app from '../src/app';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import { Token } from '../src/entities/Token';
import bcrypt from 'bcrypt';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import { SMTPServer } from 'smtp-server';
import config from 'config';

const port: number = config.get('mail.port');

// GENERAL SETTINGS
let lastMail = '';
let server: SMTPServer;
let simulateSmtpFailure = false;
class ServerError extends Error {
  responseCode?: number;
}
beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    onData(stream, session, callback) {
      let mailBody: string;
      stream.on('data', (data: unknown) => {
        mailBody += data;
      });
      stream.on('end', () => {
        if (simulateSmtpFailure) {
          const err = new ServerError('Invalid mailbox');
          err.responseCode = 553;
          return callback(err);
        }
        lastMail = mailBody;
        callback();
      });
    },
  });
  server.listen(port, 'localhost');
  await db.initialize();
});
beforeEach(async () => {
  simulateSmtpFailure = false;
  await db.manager.delete(Token, {});
  await db.manager.delete(User, {});
});
afterAll(async () => {
  server.close();
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

const postPasswordReset = async (email = 'user1@email.com', options: { language?: string } = {}) => {
  const agent = request(app).post('/api/1.0/user/password');
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  const res = (await agent.send({ email })) as unknown as Record<string, Record<string, unknown>>;
  return res;
};

const putPasswordUpdate = async (body = {}, options: { language?: string } = {}) => {
  const agent = request(app).put('/api/1.0/user/password');
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  const res = (await agent.send(body)) as unknown as Record<string, Record<string, unknown>>;
  return res;
};

describe('Password Reset Request', () => {
  it('returns 404 when a password reset request is sent for unkknown e-mail', async () => {
    const res = await postPasswordReset();
    expect(res.status).toBe(404);
  });

  it.each`
    language | message
    ${'es'}  | ${es.email_not_inuse}
    ${'en'}  | ${en.email_not_inuse}
  `(
    'returns error body with $message for unknown email for password reset and language as $language',
    async (params: { language: string; message: string }) => {
      const nowInMillis = new Date().getTime();
      const res = await postPasswordReset('user1@email.com', {
        language: params.language,
      });
      expect(res.body.path).toBe('/api/1.0/user/password');
      expect(res.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(res.body.message).toBe(params.message);
    }
  );

  it.each`
    language | message
    ${'es'}  | ${es.email_invalid}
    ${'en'}  | ${en.email_invalid}
  `(
    'returns 400 with validation error response having $message when request does not have valid email and language is $language',
    async (params: { language: string; message: string }) => {
      const res = await postPasswordReset('', {
        language: params.language,
      });
      const validationErrors = res.body.validationErrors as Record<string, unknown>;
      expect(validationErrors.email).toBe(params.message);
      expect(res.status).toBe(400);
    }
  );

  it('return 200 ok when a password reset is sent for known e-mail', async () => {
    const user = await addUser();
    const res = await postPasswordReset(user.email);
    expect(res.status).toBe(200);
  });

  it.each`
    language | message
    ${'es'}  | ${es.password_reset_request_success}
    ${'en'}  | ${en.password_reset_request_success}
  `(
    'returns success response body with $message for known email for password reset request when language is set as $language',
    async (params: { language: string; message: string }) => {
      const user = await addUser();
      const res = await postPasswordReset(user.email, { language: params.language });
      expect(res.body.message).toBe(params.message);
    }
  );

  it('creates passwordResetToken when a password reset request is sent for known e-mail', async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userInDB = await db.manager.findOne(User, {
      where: {
        email: user.email,
      },
    });
    expect(userInDB).not.toBeNull();
    expect((userInDB as User).passwordResetToken).toBeTruthy();
  });

  it('sends a password reset email with passwordResetToken', async () => {
    const user = await addUser();
    await postPasswordReset(user.email);
    const userInDB = await db.manager.findOne(User, {
      where: {
        email: user.email,
      },
    });
    expect(userInDB).not.toBeNull();
    const passwordResetToken = (userInDB as User).passwordResetToken;
    expect(lastMail).toContain('user1@email.com');
    expect(lastMail).toContain(passwordResetToken);
  });

  it('returns 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const user = await addUser();
    const res = await postPasswordReset(user.email);
    expect(res.status).toBe(502);
  });

  it.each`
    language | message
    ${'es'}  | ${es.email_failure}
    ${'en'}  | ${en.email_failure}
  `(
    'returns $message when language is set as $language after email failure',
    async (params: { language: string; message: string }) => {
      simulateSmtpFailure = true;
      const user = await addUser();
      const res = await postPasswordReset(user.email, { language: params.language });
      expect(res.body.message).toBe(params.message);
    }
  );
});

describe('Password Update', () => {
  it('return 403 when password update request does not have the valid password reset token', async () => {
    const res = await putPasswordUpdate({
      password: 'P4ssword',
      passwordResetToken: 'abcd',
    });
    expect(res.status).toBe(403);
  });

  it.each`
    language | message
    ${'es'}  | ${es.unauthorized_password_reset}
    ${'en'}  | ${en.unauthorized_password_reset}
  `(
    'returns error body with $message when language is set to $language after trying to update with invalid token',
    async (params: { language: string; message: string }) => {
      const nowInMillis = new Date().getTime();
      const res = await putPasswordUpdate(
        {
          password: 'P4ssword',
          passwordResetToken: 'abcd',
        },
        { language: params.language }
      );
      expect(res.body.path).toBe('/api/1.0/user/password');
      expect(res.body.timestamp).toBeGreaterThan(nowInMillis);
      expect(res.body.message).toBe(params.message);
    }
  );

  it('returns 403 when password update request with invalid password pattern and the reset token is invalid', async () => {
    const res = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'abcd',
    });
    expect(res.status).toBe(403);
  });

  it('return 400 when trying to update with invalid password and reset token is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await db.manager.save(User, user);
    const res = await putPasswordUpdate({
      password: 'not-valid',
      passwordResetToken: 'test-token',
    });
    expect(res.status).toBe(400);
  });

  it.each`
    language | value             | message
    ${'en'}  | ${null}           | ${en.password_null}
    ${'en'}  | ${'P4ssw'}        | ${en.password_size}
    ${'en'}  | ${'alllowercase'} | ${en.password_pattern}
    ${'en'}  | ${'ALLUPPERCASE'} | ${en.password_pattern}
    ${'en'}  | ${'12345678'}     | ${en.password_pattern}
    ${'en'}  | ${'lower&UPPER'}  | ${en.password_pattern}
    ${'en'}  | ${'lower&123'}    | ${en.password_pattern}
    ${'en'}  | ${'UPPER&123'}    | ${en.password_pattern}
    ${'es'}  | ${null}           | ${es.password_null}
    ${'es'}  | ${'P4ssw'}        | ${es.password_size}
    ${'es'}  | ${'alllowercase'} | ${es.password_pattern}
    ${'es'}  | ${'ALLUPPERCASE'} | ${es.password_pattern}
    ${'es'}  | ${'12345678'}     | ${es.password_pattern}
    ${'es'}  | ${'lower&UPPER'}  | ${es.password_pattern}
    ${'es'}  | ${'lower&123'}    | ${es.password_pattern}
    ${'es'}  | ${'UPPER&123'}    | ${es.password_pattern}
  `(
    'returns password validation error $message when language is set to $language and value is $value',
    async (params: { language: string; value: string | null; message: string }) => {
      const user = await addUser();
      user.passwordResetToken = 'test-token';
      await db.manager.save(User, user);
      const res = await putPasswordUpdate(
        {
          password: params.value,
          passwordResetToken: 'test-token',
        },
        { language: params.language }
      );
      const validationErrors = res.body.validationErrors as Record<string, unknown>;
      expect(validationErrors.password).toBe(params.message);
    }
  );

  it('returns 200 when valid password is sent with valid reset token', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await db.manager.save(User, user);
    const res = await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    expect(res.status).toBe(200);
  });

  it('updates the password in database when the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await db.manager.save(User, user);
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const userInDB = await db.manager.findOne(User, {
      where: {
        email: 'user1@email.com',
      },
    });
    expect(userInDB).not.toBeNull();
    expect((userInDB as User).password).not.toEqual(user.password);
  });

  it('clears the reset token in database when the request is valid', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await db.manager.save(User, user);
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const userInDB = await db.manager.findOne(User, {
      where: {
        email: 'user1@email.com',
      },
    });
    expect(userInDB).not.toBeNull();
    expect((userInDB as User).passwordResetToken).toBeFalsy();
  });

  it('activates and clears activation token if the account is inactive after password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    user.activationToken = 'activation-token';
    user.inactive = true;
    await db.manager.save(User, user);
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const userInDB = await db.manager.findOne(User, {
      where: {
        email: 'user1@email.com',
      },
    });
    expect(userInDB).not.toBeNull();
    expect((userInDB as User).activationToken).toBeFalsy();
    expect((userInDB as User).inactive).toBe(false);
  });

  it('clears all tokens of user after valid password reset', async () => {
    const user = await addUser();
    user.passwordResetToken = 'test-token';
    await db.manager.save(User, user);
    const token1 = db.manager.create(Token, {
      token: 'token-1',
      userId: user.id,
      lastUsedAt: Date.now().toString(),
    });
    await db.manager.save(Token, token1);
    await putPasswordUpdate({
      password: 'N3w-password',
      passwordResetToken: 'test-token',
    });
    const tokens = await db.manager.find(Token, {
      where: {
        userId: user.id,
      },
    });
    expect(tokens.length).toBe(0);
  });
});
