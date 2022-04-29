import bcrypt from 'bcrypt';
import db from '../../database/dataSource';
import { User } from '../entities/User';
import EmailService from './EmailService';
import EmailException from '../exceptions/EmailException';
import InvalidTokenException from '../exceptions/InvalidTokenException';
import NotFoundException from '../exceptions/NotFoundException';
import { Not } from 'typeorm';
import { randomString } from '../utils/generator';
import TokenService from './TokenService';
import FileService from './FileService';

const save = async (user: { username: string; email: string; password: string }) => {
  const { username, email, password } = user;
  const hash = await bcrypt.hash(password, 10);

  const queryRunner = db.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  const savedUser = await queryRunner.manager.save(User, {
    username: username,
    email: email,
    password: hash,
    activationToken: randomString(16),
  });
  try {
    await EmailService.sendAccountActivation(savedUser.email, savedUser.activationToken);
    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw new EmailException();
  } finally {
    await queryRunner.release();
  }
};

const findByEmail = async (email: string) => {
  return db.manager.find(User, {
    where: {
      email: email,
    },
  });
};

const activate = async (token: string) => {
  const user = await db.manager.findOne(User, {
    where: {
      activationToken: token,
    },
  });
  if (user) {
    user.inactive = false;
    user.activationToken = null;
    await db.manager.save(User, user);
  } else {
    throw new InvalidTokenException();
  }
};

const getUsers = async (page: number, size: number, authenticatedUser?: { id: number }) => {
  const id = authenticatedUser ? authenticatedUser.id : 0;
  const [users, count] = await db.manager.findAndCount(User, {
    select: ['id', 'username', 'email', 'image'],
    where: {
      inactive: false,
      id: Not(id),
    },
    skip: page * size,
    take: size,
  });
  return {
    content: users,
    page: page,
    size: size,
    totalPages: Math.ceil(count / size),
  };
};

const getUser = async (id: number) => {
  const user = await db.manager.findOne(User, {
    select: ['id', 'username', 'email', 'image'],
    where: {
      id: id,
      inactive: false,
    },
  });
  if (!user) {
    throw new NotFoundException('user_not_found');
  }
  return user;
};

const updateUser = async (id: number, updatedBody: { username?: string; image?: string }) => {
  const manager = db.manager;
  const user = await manager.findOne(User, {
    where: {
      id: id,
    },
  });
  if (user && updatedBody.username) {
    user.username = updatedBody.username;
  }
  if (updatedBody.image) {
    if (user) {
      if (user.image) {
        await FileService.deleteProfileImage(user.image);
      }
      user.image = (await FileService.saveProfileImage(updatedBody.image)) as string;
    }
  }
  if (user) {
    await manager.save(User, user);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      image: user.image,
    };
  }
  return null;
};

const deleteUser = async (id: number) => {
  const user = await db.manager.findOne(User, {
    where: {
      id: id,
    },
  });
  await db.manager.remove(User, user);
};

const passwordResetRequest = async (email: string) => {
  const users = await findByEmail(email);
  if (!users.length) {
    throw new NotFoundException('email_not_inuse');
  }
  users[0].passwordResetToken = randomString(16);
  await db.manager.save(User, users[0]);
  try {
    await EmailService.sendPasswordReset(email, users[0].passwordResetToken);
  } catch (err) {
    throw new EmailException();
  }
};

const updatePassword = async (updateRequest: { passwordResetToken: string; password: string }) => {
  const user = await findByPasswordResetToken(updateRequest.passwordResetToken);
  const hash = await bcrypt.hash(updateRequest.password, 10);
  if (user) {
    user.password = hash;
    user.passwordResetToken = null;
    user.inactive = false;
    user.activationToken = null;
    await db.manager.save(User, user);
    await TokenService.clearTokens(user.id as number);
  }
};

const findByPasswordResetToken = (token: string) => {
  return db.manager.findOne(User, {
    where: {
      passwordResetToken: token,
    },
  });
};

export default {
  save,
  findByEmail,
  activate,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  passwordResetRequest,
  updatePassword,
  findByPasswordResetToken,
};
