import FileService from '../src/services/FileService';
import fs from 'fs';
import path from 'path';
import config from 'config';
import { FileAttachment } from '../src/entities/FileAttachment';
import db from '../database/dataSource';
import { User } from '../src/entities/User';
import { Hoax } from '../src/entities/Hoax';

const uploadDir: string = config.get('uploadDir');
const profileDir: string = config.get('profileDir');
const attachmentDir: string = config.get('attachmentDir');
const profileFolder = path.join('.', uploadDir, profileDir);
const attachmentFolder = path.join('.', uploadDir, attachmentDir);

// SETTINGS
beforeAll(async () => {
  await db.initialize();
});
afterAll(async () => {
  await db.destroy();
});

describe('createFolders', () => {
  it('creates upload folder', () => {
    FileService.createFolders();
    expect(fs.existsSync(uploadDir)).toBe(true);
  });

  it('creates profile folder under upload folder', () => {
    FileService.createFolders();
    expect(fs.existsSync(profileFolder)).toBe(true);
  });

  it('creates attachments folder under upload folder', () => {
    FileService.createFolders();
    expect(fs.existsSync(attachmentFolder)).toBe(true);
  });
});

describe('Scheduled unused file clean up', () => {
  const filename = 'test-file' + Date.now().toString();
  const testFile = path.join('.', '__tests__', 'resources', 'test-png.png');
  const targetPath = path.join(attachmentFolder, filename);

  beforeEach(async () => {
    await db.manager.delete(FileAttachment, {});
    await db.manager.delete(Hoax, {});
    await db.manager.delete(User, {});
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
  });

  const addHoax = async () => {
    const res = await db.manager.insert(User, {
      username: `user1`,
      email: `user1@email.com`,
    });
    const insertResult = await db.manager.insert(Hoax, {
      content: `hoax content 1`,
      timestamp: Date.now(),
      userId: res.raw as number,
    });
    return insertResult.raw as number;
  };

  it('removes the 24 hours old file with attachment entry if not used in hoax', async () => {
    fs.copyFileSync(testFile, targetPath);
    const uploadDate = Date.now() - 24 * 60 * 60 * 1000 - 1;
    const insertResult = await db.manager.insert(FileAttachment, {
      filename: filename,
      uploadDate: uploadDate,
      fileType: 'image/png',
    });
    await FileService.removeUnusedAttchments();
    const attachment = await db.manager.findOne(FileAttachment, {
      where: {
        id: insertResult.raw as number,
      },
    });
    expect(attachment).toBeNull();
    expect(fs.existsSync(targetPath)).toBe(false);
  });

  it('test schedule attachment cleanup', (done: jest.DoneCallback) => {
    jest.useFakeTimers();
    fs.copyFileSync(testFile, targetPath);
    const uploadDate = Date.now() - 24 * 60 * 60 * 1000 - 1;
    db.manager
      .insert(FileAttachment, {
        filename: filename,
        uploadDate: uploadDate,
        fileType: 'image/png',
      })
      .then((insertResult) => {
        FileService.scheduleAttachmentCleanUp();
        jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 5000);
        jest.useRealTimers();
        setTimeout(() => {
          db.manager
            .findOne(FileAttachment, {
              where: {
                id: insertResult.raw as number,
              },
            })
            .then((attachment) => {
              expect(attachment).toBeNull();
              expect(fs.existsSync(targetPath)).toBe(false);
              done();
            })
            .catch((err) => {
              console.log(err);
              done();
            });
        }, 1000);
      })
      .catch((err) => {
        console.log(err);
        done();
      });
  });

  it('keeps the files younger than 24 hours and their database entry', (done: jest.DoneCallback) => {
    jest.useFakeTimers();
    fs.copyFileSync(testFile, targetPath);
    const uploadDate = Date.now() - 23 * 60 * 60 * 1000;
    db.manager
      .insert(FileAttachment, {
        filename: 'test-file1',
        uploadDate: uploadDate,
        fileType: 'image/png',
      })
      .then((results) => {
        const attachId = results.raw as number;
        FileService.scheduleAttachmentCleanUp();
        jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 5000);
        jest.useRealTimers();
        setTimeout(() => {
          db.manager
            .findOne(FileAttachment, {
              where: {
                id: attachId,
              },
            })
            .then((attachment) => {
              expect(attachment).not.toBeNull();
              expect(fs.existsSync(targetPath)).toBe(true);
              done();
            })
            .catch((err) => {
              console.log(err);
            });
        }, 1000);
      })
      .catch((err) => {
        console.log(err);
      });
  });

  it('keeps the files older than 24 hours and their database entry if associated with hoax', (done: jest.DoneCallback) => {
    jest.useFakeTimers();
    fs.copyFileSync(testFile, targetPath);
    addHoax()
      .then((id) => {
        const uploadDate = Date.now() - 23 * 60 * 60 * 1000;
        db.manager
          .insert(FileAttachment, {
            filename: 'test-file1',
            uploadDate: uploadDate,
            fileType: 'image/png',
            hoaxId: id,
          })
          .then((results) => {
            const attachId = results.raw as number;
            FileService.scheduleAttachmentCleanUp();
            jest.advanceTimersByTime(24 * 60 * 60 * 1000 + 5000);
            jest.useRealTimers();
            setTimeout(() => {
              db.manager
                .findOne(FileAttachment, {
                  where: {
                    id: attachId,
                  },
                })
                .then((attachment) => {
                  expect(attachment).not.toBeNull();
                  expect(fs.existsSync(targetPath)).toBe(true);
                  done();
                })
                .catch((err) => {
                  console.log(err);
                });
            }, 1000);
          })
          .catch((err) => {
            console.log(err);
          });
      })
      .catch((err) => {
        console.log(err);
      });
  });
});
