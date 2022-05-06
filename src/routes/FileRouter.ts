import express from 'express';
import FileService from '../services/FileService';
import wrapAsync from '../utils/wrapAsync';
import multer from 'multer';
import FileSizeException from '../exceptions/FileSizeException';

const FIVE_MB = 5 * 1024 * 1024;

const upload = multer({ limits: { fileSize: FIVE_MB } }).single('file');

const router = express.Router();

const postAttachment = async (req: express.Request, res: express.Response) => {
  const attachment = await FileService.saveAttachment(req.file);
  return res.send(attachment);
};

const uploadFile = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload(req, res, (err) => {
    if (err) {
      return next(new FileSizeException());
    }
    next();
  });
};

router.post('/api/1.0/hoaxes/attachments', uploadFile, wrapAsync(postAttachment));

export default router;
