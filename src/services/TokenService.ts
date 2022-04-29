import { User } from '../entities/User';
import { randomString } from '../utils/generator';
import { Token } from '../entities/Token';
import db from '../../database/dataSource';
import { LessThan, MoreThan } from 'typeorm';
import logger from '../utils/logger';

const ONE_WEEK_IN_MILLIS = 7 * 24 * 60 * 60 * 1000;

const createToken = async (user: User) => {
  const token = randomString(32);
  const tokenInstance = db.manager.create(Token, {
    token: token,
    userId: user.id,
    lastUsedAt: Date.now().toString(),
  });
  await db.manager.save(tokenInstance);

  return token;
};

const verify = async (token: string) => {
  const oneWeekAgo = (Date.now() - ONE_WEEK_IN_MILLIS).toString();
  const tokenInDB = await db.manager.findOne(Token, {
    where: {
      token: token,
      lastUsedAt: MoreThan(oneWeekAgo),
    },
  });
  if (tokenInDB) {
    tokenInDB.lastUsedAt = Date.now().toString();
    await db.manager.save(tokenInDB);
    const userId = tokenInDB.userId;
    return { id: userId as number };
  }
  return { id: 0 };
};

const deleteToken = async (token: string) => {
  const storedToken = await db.manager.findOne(Token, {
    where: {
      token: token,
    },
  });
  await db.manager.remove(Token, storedToken);
};

const scheduleCleanup = (intervalInMillis: number = 60 * 60 * 1000) => {
  setInterval(() => {
    const oneWeekAgo = (Date.now() - ONE_WEEK_IN_MILLIS).toString();
    const tokenRepository = db.getRepository(Token);
    tokenRepository
      .findBy({ lastUsedAt: LessThan(oneWeekAgo) })
      .then(async (tokens) => {
        await tokenRepository.remove(tokens);
      })
      .catch((err) => {
        logger.error(err);
      });
  }, intervalInMillis);
};

const clearTokens = async (userId: number) => {
  const tokensToDelete = await db.manager.find(Token, {
    where: {
      userId: userId,
    },
  });
  await db.manager.remove(tokensToDelete);
};

export default { createToken, verify, deleteToken, scheduleCleanup, clearTokens };
