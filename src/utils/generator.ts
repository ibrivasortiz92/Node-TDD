import crypto from 'crypto';

const randomString = (length: number) => {
  return crypto.randomBytes(length).toString('hex').substring(0, length);
};

export { randomString };
