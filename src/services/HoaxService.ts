import db from '../../database/dataSource';
import { Hoax } from '../entities/Hoax';
import { User } from '../entities/User';
import NotFoundException from '../exceptions/NotFoundException';

const save = async (id: number, content?: string) => {
  await db.manager.insert(Hoax, {
    content,
    timestamp: Date.now(),
    userId: id,
  });
};

const getHoaxes = async (page: number, size: number, userId?: number) => {
  let where = {};
  if (userId) {
    const user = await db.manager.findOne(User, {
      where: {
        id: userId,
      },
    });
    if (!user) {
      throw new NotFoundException('user_not_found');
    }
    where = { userId };
  }
  const [hoaxes, count] = await db.manager.findAndCount(Hoax, {
    relations: {
      user: true,
    },
    select: {
      id: true,
      content: true,
      timestamp: true,
      user: {
        id: true,
        username: true,
        email: true,
        image: true,
      },
    },
    where,
    order: {
      timestamp: 'DESC',
    },
    take: size,
    skip: page * size,
  });
  return {
    content: hoaxes,
    page: page,
    size: size,
    totalPages: Math.ceil(count / size),
  };
};

export default { save, getHoaxes };
