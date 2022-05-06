import express from 'express';
import AuthenticationException from '../exceptions/AuthenticationException';
import HoaxService from '../services/HoaxService';
import { check, validationResult } from 'express-validator';
import ValidationException from '../exceptions/ValidationException';
import pagination from '../middlewares/pagination';
import wrapAsync from '../utils/wrapAsync';
import ForbiddenException from '../exceptions/ForbiddenException';

interface Request<T> extends express.Request {
  body: T;
}

interface PostHoaxBodyInterface {
  content?: string;
  fileAttachmentId?: number;
}

const postHoax = async (req: Request<PostHoaxBodyInterface>, res: express.Response) => {
  if (!req.authenticatedUser) {
    throw new AuthenticationException('unauthorized_hoax_submit');
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationException(errors.array());
  }
  const { content, fileAttachmentId } = req.body;
  const { id } = req.authenticatedUser;
  await HoaxService.save(id, content, fileAttachmentId);
  return res.send({ message: req.t('hoax_submit_sucess') });
};

const getHoaxes = async (req: express.Request, res: express.Response) => {
  if (!req.pagination) {
    throw new Error('Pagination Error');
  }
  const { page, size } = req.pagination;
  const hoaxesPage = await HoaxService.getHoaxes(page, size);
  return res.send(hoaxesPage);
};

const getUserHoaxes = async (req: express.Request, res: express.Response) => {
  if (!req.pagination) {
    throw new Error('Pagination Error');
  }
  const { page, size } = req.pagination;
  const userId = Number.parseInt(req.params.id);
  const hoaxes = await HoaxService.getHoaxes(page, size, userId);
  return res.send(hoaxes);
};

const router = express.Router();

const deleteHoax = async (req: express.Request, res: express.Response) => {
  if (!req.authenticatedUser) {
    throw new ForbiddenException('unauthorized_hoax_delete');
  }
  await HoaxService.deleteHoax(Number.parseInt(req.params.id), req.authenticatedUser.id);

  return res.send();
};

router.post(
  '/api/1.0/hoaxes',
  check('content').isLength({ min: 10, max: 5000 }).withMessage('hoax_content_size'),
  wrapAsync(postHoax)
);

router.get('/api/1.0/hoaxes', pagination, wrapAsync(getHoaxes));

router.get('/api/1.0/users/:id/hoaxes', pagination, wrapAsync(getUserHoaxes));

router.delete('/api/1.0/hoaxes/:id', wrapAsync(deleteHoax));

export default router;
