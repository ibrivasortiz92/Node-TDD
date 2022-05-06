import db from '../../database/dataSource';
import { Hoax } from '../entities/Hoax';
import { User } from '../entities/User';
import ForbiddenException from '../exceptions/ForbiddenException';
import NotFoundException from '../exceptions/NotFoundException';
import FileService from './FileService';

const save = async (id: number, content?: string, fileAttachmentId?: number) => {
  const insertResult = await db.manager.insert(Hoax, {
    content,
    timestamp: Date.now(),
    userId: id,
  });
  if (fileAttachmentId) {
    const hoaxId: number = insertResult.raw as number;
    await FileService.associateFileToHoax(fileAttachmentId, hoaxId);
  }
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
      fileAttachment: true,
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
      fileAttachment: {
        filename: true,
        fileType: true,
      },
    },
    where,
    order: {
      timestamp: 'DESC',
    },
    take: size,
    skip: page * size,
  });

  const newContent = hoaxes.map((hoax) => {
    if (hoax.fileAttachment === null) {
      delete hoax['fileAttachment'];
    }
    return hoax;
  });

  return {
    content: newContent,
    page: page,
    size: size,
    totalPages: Math.ceil(count / size),
  };
};

const deleteHoax = async (hoaxId: number, userId: number) => {
  const hoaxToBeDeleted = await db.manager.findOne(Hoax, {
    relations: {
      fileAttachment: true,
    },
    where: {
      id: hoaxId,
      userId: userId,
    },
  });
  if (!hoaxToBeDeleted) {
    throw new ForbiddenException('unauthorized_hoax_delete');
  }
  if (hoaxToBeDeleted.fileAttachment) {
    await FileService.deleteAttachment(hoaxToBeDeleted.fileAttachment.filename);
  }
  await db.manager.remove(Hoax, hoaxToBeDeleted);
};

export default { save, getHoaxes, deleteHoax };
