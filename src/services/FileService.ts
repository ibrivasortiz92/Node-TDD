import fs from 'fs';
import path from 'path';
import config from 'config';
import { randomString } from '../utils/generator';
import FileType from 'file-type';
import db from '../../database/dataSource';
import { FileAttachment } from '../entities/FileAttachment';
import { IsNull, LessThan } from 'typeorm';
import logger from '../utils/logger';

const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const attachmentDir: string = config.get('attachmentDir');
const profileFolder = path.join('.', uploadDir, profileDir);
const attachmentFolder = path.join('.', uploadDir, attachmentDir);

const createFolders = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  if (!fs.existsSync(profileFolder)) {
    fs.mkdirSync(profileFolder);
  }
  if (!fs.existsSync(attachmentFolder)) {
    fs.mkdirSync(attachmentFolder);
  }
};

const saveProfileImage = async (base64File?: string) => {
  if (base64File) {
    const filename = randomString(32);
    const filePath = path.join(profileFolder, filename);
    await fs.promises.writeFile(filePath, base64File, 'base64');
    return filename;
  }
  return null;
};

const deleteProfileImage = async (filename: string) => {
  const filePath = path.join(profileFolder, filename);
  await fs.promises.unlink(filePath);
};

const isLessThan2MB = (buffer: Buffer) => {
  return buffer.length <= 2 * 1024 * 1024;
};

const isSupportedFileType = async (buffer: Buffer) => {
  const type = await FileType.fromBuffer(buffer);
  return !type ? false : type.mime === 'image/png' || type.mime === 'image/jpeg';
};

const saveAttachment = async (file?: Express.Multer.File) => {
  if (file) {
    const type = await FileType.fromBuffer(file.buffer);
    let filename = randomString(32);
    if (type) {
      filename += `.${type.ext}`;
    }
    await fs.promises.writeFile(path.join(attachmentFolder, filename), file.buffer);
    const insertResult = await db.manager.insert(FileAttachment, {
      filename,
      uploadDate: Date.now(),
      fileType: type ? type.mime : 'non',
    });
    return { id: insertResult.raw as number };
  }
  return { id: 0 };
};

const associateFileToHoax = async (attachmentId: number, hoaxId: number) => {
  const attachment = await db.manager.findOne(FileAttachment, {
    where: {
      id: attachmentId,
    },
  });
  if (attachment && !attachment.hoaxId) {
    await db.manager.update(FileAttachment, attachmentId, {
      hoaxId: hoaxId,
    });
  }
};

const ONE_DAY = 24 * 60 * 60 * 100;

const removeUnusedAttchments = async () => {
  const oneDayOld = Date.now() - ONE_DAY;
  const attachments = await db.manager.find(FileAttachment, {
    where: {
      uploadDate: LessThan(oneDayOld),
      hoaxId: IsNull(),
    },
  });
  for (const attachment of attachments) {
    await fs.promises.unlink(path.join(attachmentFolder, attachment.filename));
    await db.manager.remove(attachment);
  }
};

const scheduleAttachmentCleanUp = () => {
  setInterval(() => {
    removeUnusedAttchments()
      .then(() => {
        logger.info('Attachment clean up');
      })
      .catch((err) => {
        logger.error(err);
      });
  }, ONE_DAY);
};

const deleteAttachment = async (filename: string) => {
  const filePath = path.join(attachmentFolder, filename);
  try {
    await fs.promises.access(filePath);
    await fs.promises.unlink(filePath);
  } catch (err) {
    console.log(err);
  }
};

export default {
  createFolders,
  saveProfileImage,
  deleteProfileImage,
  isLessThan2MB,
  isSupportedFileType,
  saveAttachment,
  associateFileToHoax,
  removeUnusedAttchments,
  scheduleAttachmentCleanUp,
  deleteAttachment,
};
