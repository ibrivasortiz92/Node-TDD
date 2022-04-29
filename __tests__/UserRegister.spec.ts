import request from 'supertest';
import app from '../src/app';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import EmailService from '../src/services/EmailService';
import { SMTPServer } from 'smtp-server';
import en from '../locales/en/translation.json';
import es from '../locales/es/translation.json';
import config from 'config';
import { Token } from '../src/entities/Token';

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
      stream.on('data', (data: Record<string, unknown>) => {
        mailBody += data.toString();
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
const validUser = {
  username: 'user1',
  email: 'user1@email.com',
  password: 'P4ssword',
};

const postUser = async (user: User = validUser, options: { language?: string } = {}) => {
  const agent = request(app).post('/api/1.0/users');
  if (options.language) {
    void agent.set('Accept-Language', options.language);
  }
  const res = (await agent.send(user)) as unknown as Record<string, Record<string, Record<string, unknown>>>;
  return res;
};

// TEST SUITES
describe('User Registration', () => {
  it('returns 200 OK when signup request is valid', async () => {
    const response = await postUser();
    expect(response.status).toBe(200);
  });

  it('returns success message when signup request is valid', async () => {
    const response = await postUser();
    expect(response.body.message).toBe(en.user_create_success);
  });

  it('saves the user to database', async () => {
    await postUser();
    const userList = await db.manager.find(User);
    expect(userList.length).toBe(1);
  });

  it('saves the username and email to database', async () => {
    await postUser();
    const userList = await db.manager.find(User);
    const savedUser = userList[0];
    expect(savedUser.username).toBe('user1');
    expect(savedUser.email).toBe('user1@email.com');
  });

  it('hashes the password in database', async () => {
    await postUser();
    const userList = await db.manager.find(User);
    const savedUser = userList[0];
    expect(savedUser.password).not.toBe('P4ssword');
  });

  it('returns 400 when username is null', async () => {
    const res = await postUser({
      username: null,
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    expect(res.status).toBe(400);
  });

  it('returns validationErrors field in response body when validation error occurs', async () => {
    const res = await postUser({
      username: null,
      email: 'user1@email.com',
      password: 'P4ssword',
    });
    const body = res.body;
    expect(body.validationErrors).not.toBeUndefined();
  });

  it('returns errors for both when username and email are null', async () => {
    const res = await postUser({
      username: null,
      email: null,
      password: 'P4ssword',
    });
    const body = res.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it.each`
    field         | value               | expectedMessage
    ${'username'} | ${null}             | ${en.username_null}
    ${'username'} | ${'usr'}            | ${en.username_size}
    ${'username'} | ${'a'.repeat(33)}   | ${en.username_size}
    ${'email'}    | ${null}             | ${en.email_null}
    ${'email'}    | ${'email.com'}      | ${en.email_invalid}
    ${'email'}    | ${'user.email.com'} | ${en.email_invalid}
    ${'email'}    | ${'user@mail'}      | ${en.email_invalid}
    ${'password'} | ${null}             | ${en.password_null}
    ${'password'} | ${'P4ssw'}          | ${en.password_size}
    ${'password'} | ${'alllowercase'}   | ${en.password_pattern}
    ${'password'} | ${'ALLUPPERCASE'}   | ${en.password_pattern}
    ${'password'} | ${'12345678'}       | ${en.password_pattern}
    ${'password'} | ${'lower&UPPER'}    | ${en.password_pattern}
    ${'password'} | ${'lower&123'}      | ${en.password_pattern}
    ${'password'} | ${'UPPER&123'}      | ${en.password_pattern}
  `(
    'returns $expectedMessage when $field is $value',
    async (params: { field: 'username' | 'email' | 'password'; value: string | null; expectedMessage: string }) => {
      const user = {
        username: 'user1' as string | null,
        email: 'user1@email.com' as string | null,
        password: 'P4ssword' as string | null,
      };
      user[params.field] = params.value;
      const response = await postUser(user);
      const body = response.body;
      expect(body.validationErrors[params.field]).toBe(params.expectedMessage);
    }
  );

  it(`returns ${en.email_inuse} when same email is already taken`, async () => {
    const user = new User();
    user.username = validUser.username;
    user.email = validUser.email;
    user.password = validUser.password;
    await db.manager.save(user);
    const response = await postUser();
    expect(response.body.validationErrors.email).toBe(en.email_inuse);
  });

  it('returns errors for both username is null and email is in use', async () => {
    const user = new User();
    user.username = validUser.username;
    user.email = validUser.email;
    user.password = validUser.password;
    await db.manager.save(user);
    const response = await postUser({
      username: null,
      email: user.email,
      password: 'P4ssword',
    });
    const body = response.body;
    expect(Object.keys(body.validationErrors)).toEqual(['username', 'email']);
  });

  it('creates user in inactive mode', async () => {
    await postUser();
    const users = await db.manager.find(User);
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates user in inactive mode even the request body contains inactive as false', async () => {
    const newUser = { ...validUser, inactive: false };
    await postUser(newUser);
    const users = await db.manager.find(User);
    const savedUser = users[0];
    expect(savedUser.inactive).toBe(true);
  });

  it('creates an activationToken for user', async () => {
    await postUser();
    const users = await db.manager.find(User);
    const savedUser = users[0];
    expect(savedUser.activationToken).toBeTruthy();
  });

  it('sends an Account activation email with activationToken', async () => {
    await postUser();
    const users = await db.manager.find(User);
    const savedUser = users[0];

    expect(lastMail).toContain('user1@email.com');
    expect(lastMail).toContain(savedUser.activationToken);
  });

  it('return 502 Bad Gateway when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.status).toBe(502);
  });

  it('return Email failure message when sending email fails', async () => {
    simulateSmtpFailure = true;
    const response = await postUser();
    expect(response.body.message).toBe(en.email_failure);
  });

  it('does not save user to database if activation email fails', async () => {
    const mockSendAccountActivation = jest
      .spyOn(EmailService, 'sendAccountActivation')
      .mockRejectedValue({ message: 'Failed to deliver email' });
    await postUser();
    mockSendAccountActivation.mockRestore();
    const users = await db.manager.find(User);
    expect(users.length).toBe(0);
  });

  it('return Validation Failure message in error response body when validation fails', async () => {
    const res = await postUser({
      username: null,
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.body.message).toBe(en.validation_failure);
  });
});

describe('Internationalization', () => {
  it.each`
    field         | value               | expectedMessage
    ${'username'} | ${null}             | ${es.username_null}
    ${'username'} | ${'usr'}            | ${es.username_size}
    ${'username'} | ${'a'.repeat(33)}   | ${es.username_size}
    ${'email'}    | ${null}             | ${es.email_null}
    ${'email'}    | ${'email.com'}      | ${es.email_invalid}
    ${'email'}    | ${'user.email.com'} | ${es.email_invalid}
    ${'email'}    | ${'user@mail'}      | ${es.email_invalid}
    ${'password'} | ${null}             | ${es.password_null}
    ${'password'} | ${'P4ssw'}          | ${es.password_size}
    ${'password'} | ${'alllowercase'}   | ${es.password_pattern}
    ${'password'} | ${'ALLUPPERCASE'}   | ${es.password_pattern}
    ${'password'} | ${'12345678'}       | ${es.password_pattern}
    ${'password'} | ${'lower&UPPER'}    | ${es.password_pattern}
    ${'password'} | ${'lower&123'}      | ${es.password_pattern}
    ${'password'} | ${'UPPER&123'}      | ${es.password_pattern}
  `(
    'returns $expectedMessage when $field is $value is set as Spanish',
    async (params: { field: 'username' | 'email' | 'password'; value: string | null; expectedMessage: string }) => {
      const user = {
        username: 'user1' as string | null,
        email: 'user1@email.com' as string | null,
        password: 'P4ssword' as string | null,
      };
      user[params.field] = params.value;
      const response = await postUser(user, { language: 'es' });
      const body = response.body;
      expect(body.validationErrors[params.field]).toBe(params.expectedMessage);
    }
  );

  it(`returns ${es.email_inuse} when same email is already taken when language is set as Spanish`, async () => {
    const user = new User();
    user.username = validUser.username;
    user.email = validUser.email;
    user.password = validUser.password;
    await db.manager.save(user);
    const response = await postUser({ ...validUser }, { language: 'es' });
    expect(response.body.validationErrors.email).toBe(es.email_inuse);
  });

  it(`returns success message ${es.user_create_success} when signup request is valid and language is set as Spanish`, async () => {
    const response = await postUser({ ...validUser }, { language: 'es' });
    expect(response.body.message).toBe(es.user_create_success);
  });
  it(`returns ${es.email_failure} message when sending email fails and language is set as Spanish`, async () => {
    simulateSmtpFailure = true;
    const response = await postUser({ ...validUser }, { language: 'es' });
    expect(response.body.message).toBe(es.email_failure);
  });
  it(`return ${es.validation_failure} message in error response body when validation fails`, async () => {
    const res = await postUser(
      {
        username: null,
        email: validUser.email,
        password: validUser.password,
      },
      { language: 'es' }
    );
    expect(res.body.message).toBe(es.validation_failure);
  });
});

describe('Account activation', () => {
  it('activates the account when correct token is sent', async () => {
    await postUser();
    let users = await db.manager.find(User);
    const token = users[0].activationToken as string;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    users = await db.manager.find(User);
    expect(users[0].inactive).toBe(false);
  });

  it('remove the token from user table after successful activation', async () => {
    await postUser();
    let users = await db.manager.find(User);
    const token = users[0].activationToken as string;

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    users = await db.manager.find(User);
    expect(users[0].activationToken).toBeFalsy();
  });

  it('does not activate the account when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    const users = await db.manager.find(User);
    expect(users[0].inactive).toBe(true);
  });

  it('returns bad request when token is wrong', async () => {
    await postUser();
    const token = 'this-token-does-not-exist';

    const response = await request(app)
      .post('/api/1.0/users/token/' + token)
      .send();
    expect(response.status).toBe(400);
  });

  it.each`
    language | tokenStatus  | message
    ${'es'}  | ${'wrong'}   | ${es.account_activation_failure}
    ${'en'}  | ${'wrong'}   | ${en.account_activation_failure}
    ${'es'}  | ${'correct'} | ${es.account_activation_success}
    ${'en'}  | ${'correct'} | ${en.account_activation_success}
  `(
    'returns $message when token is $tokenStatus and language is $language',
    async (params: { language: string; message: string; tokenStatus: string }) => {
      await postUser();
      let token = 'this-token-does-not-exist';
      if (params.tokenStatus === 'correct') {
        const users = await db.manager.find(User);
        token = users[0].activationToken as string;
      }
      const response = (await request(app)
        .post('/api/1.0/users/token/' + token)
        .set('Accept-Language', params.language)
        .send()) as unknown as Record<string, Record<string, unknown>>;
      expect(response.body.message).toBe(params.message);
    }
  );
});

describe('Error Model', () => {
  it('returns path, timestamp, message and validationErrors in response when validation failure', async () => {
    const response = await postUser({ ...validUser, username: null });
    const body = response.body;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message', 'validationErrors']);
  });

  it('returns path, timestamp and message in response when request fails other than validation error', async () => {
    const token = 'this-token-does-not-exist';
    const response = (await request(app)
      .post('/api/1.0/users/token/' + token)
      .send()) as unknown as Record<string, Record<string, unknown>>;
    const body = response.body;
    expect(Object.keys(body)).toEqual(['path', 'timestamp', 'message']);
  });

  it('returns path in error body', async () => {
    const token = 'this-token-does-not-exist';
    const response = (await request(app)
      .post('/api/1.0/users/token/' + token)
      .send()) as unknown as Record<string, Record<string, unknown>>;
    const body = response.body;
    expect(body.path).toEqual('/api/1.0/users/token/' + token);
  });

  it('returns timestamp in milliseconds within 5 seconds value in error body', async () => {
    const nowInMillis = new Date().getTime();
    const fiveSecondsLater = nowInMillis + 5000;
    const token = 'this-token-does-not-exist';
    const response = (await request(app)
      .post('/api/1.0/users/token/' + token)
      .send()) as unknown as Record<string, Record<string, unknown>>;
    const body = response.body;
    expect(body.timestamp).toBeGreaterThan(nowInMillis);
    expect(body.timestamp).toBeLessThan(fiveSecondsLater);
  });
});
