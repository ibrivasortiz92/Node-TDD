import express from 'express';
import { check, validationResult } from 'express-validator';
import ValidationException from '../exceptions/ValidationException';
import UserService from '../services/UserService';
import pagination from '../middlewares/pagination';
import ForbiddenException from '../exceptions/ForbiddenException';
import FileService from '../services/FileService';
import logger from '../utils/logger';

const router = express.Router();

router.post(
  '/api/1.0/users',

  // USERNAME CHECK
  check('username')
    .notEmpty()
    .withMessage('username_null')
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage('username_size'),

  // EMAIL CHECK
  check('email')
    .notEmpty()
    .withMessage('email_null')
    .bail()
    .isEmail()
    .withMessage('email_invalid')
    .bail()
    .custom(async (email: string) => {
      const user = await UserService.findByEmail(email);
      if (user.length) {
        throw new Error('email_inuse');
      }
    }),

  // PASSWORD CHECK
  check('password')
    .notEmpty()
    .withMessage('password_null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('password_size')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage('password_pattern'),

  // CONTROLLER
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }

    // CORE
    const user = req.body as { username: string; email: string; password: string };
    try {
      await UserService.save(user);
      return res.send({
        message: req.t('user_create_success'),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/api/1.0/users/token/:token', (req, res, next) => {
  const token = req.params.token;
  UserService.activate(token)
    .then(() => {
      return res.send({ message: req.t('account_activation_success') });
    })
    .catch((err) => {
      return next(err);
    });
});

router.get('/api/1.0/users', pagination, async (req, res) => {
  const authenticatedUser = req.authenticatedUser;
  if (req.pagination) {
    const { page, size } = req.pagination;
    const users = await UserService.getUsers(page, size, authenticatedUser);
    res.send(users);
  }
});

router.get('/api/1.0/users/:id', (req, res, next) => {
  const id = Number.parseInt(req.params.id);
  UserService.getUser(id)
    .then((user) => {
      res.send(user);
    })
    .catch((err) => {
      next(err);
    });
});

router.put(
  '/api/1.0/users/:id',
  // USERNAME CHECK
  check('username')
    .notEmpty()
    .withMessage('username_null')
    .bail()
    .isLength({ min: 4, max: 32 })
    .withMessage('username_size'),
  check('image').custom(async (imageAsBase64String: string) => {
    if (!imageAsBase64String) {
      return true;
    }
    const buffer = Buffer.from(imageAsBase64String, 'base64');
    if (!FileService.isLessThan2MB(buffer)) {
      throw new Error('profile_image_size');
    }
    const supportedType = await FileService.isSupportedFileType(buffer);
    if (!supportedType) {
      throw new Error('unsupported_image_file');
    }
    return true;
  }),
  async (req, res, next) => {
    const authenticatedUser = req.authenticatedUser;
    let idAsString = '-1';
    if (req.params) {
      idAsString = req.params.id as string;
    }
    const id = Number.parseInt(idAsString);
    if (!authenticatedUser || authenticatedUser.id !== id) {
      return next(new ForbiddenException('unauthorized_user_update'));
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    const updateBody = req.body as { username?: string; image?: string };
    const user = await UserService.updateUser(id, updateBody);
    return res.send(user);
  }
);

router.delete('/api/1.0/users/:id', (req, res, next) => {
  const authenticatedUser = req.authenticatedUser;
  const id = Number.parseInt(req.params.id);
  if (!authenticatedUser || authenticatedUser.id !== id) {
    return next(new ForbiddenException('unauthorized_user_delete'));
  }
  UserService.deleteUser(id)
    .then(() => {
      res.send();
    })
    .catch((err) => {
      logger.error(err);
    });
});

router.post('/api/1.0/user/password', check('email').isEmail().withMessage('email_invalid'), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ValidationException(errors.array()));
  }
  try {
    const { email } = req.body as { email: string };
    await UserService.passwordResetRequest(email);
    return res.send({
      message: req.t('password_reset_request_success'),
    });
  } catch (err) {
    next(err);
  }
});

const passwordResetTokenValidator = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const { passwordResetToken } = req.body as { passwordResetToken: string };
  UserService.findByPasswordResetToken(passwordResetToken)
    .then((user) => {
      if (!user) {
        return next(new ForbiddenException('unauthorized_password_reset'));
      }
      next();
    })
    .catch((err) => {
      logger.error(err);
    });
};

router.put(
  '/api/1.0/user/password',
  passwordResetTokenValidator,
  check('password')
    .notEmpty()
    .withMessage('password_null')
    .bail()
    .isLength({ min: 6 })
    .withMessage('password_size')
    .bail()
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
    .withMessage('password_pattern'),
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return next(new ValidationException(errors.array()));
    }
    const body = req.body as { passwordResetToken: string; password: string };
    await UserService.updatePassword(body);
    res.send();
  }
);

export default router;
