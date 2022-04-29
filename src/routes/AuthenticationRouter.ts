import express from 'express';
import bcrypt from 'bcrypt';
import UserService from '../services/UserService';
import AuthenticationException from '../exceptions/AuthenticationException';
import ForbiddenException from '../exceptions/ForbiddenException';
import { check, validationResult } from 'express-validator';
import TokenService from '../services/TokenService';
import logger from '../utils/logger';

const router = express.Router();

router.post('/api/1.0/auth', check('email').isEmail(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AuthenticationException());
  }
  const { email, password } = req.body as { email: string; password: string };
  const user = await UserService.findByEmail(email);
  if (user.length === 0) {
    return next(new AuthenticationException());
  }
  const match = await bcrypt.compare(password, user[0].password as string);
  if (!match) {
    return next(new AuthenticationException());
  }
  if (user[0].inactive) {
    return next(new ForbiddenException());
  }

  const token = await TokenService.createToken(user[0]);

  res.send({
    id: user[0].id,
    username: user[0].username,
    image: user[0].image,
    token,
  });
});

router.post('/api/1.0/logout', (req, res) => {
  const authorization = req.headers.authorization;
  if (authorization) {
    const token = authorization.substring(7);
    TokenService.deleteToken(token)
      .then(() => {
        res.send();
      })
      .catch((err) => {
        logger.error(err);
      });
  } else {
    res.send();
  }
});

export default router;
