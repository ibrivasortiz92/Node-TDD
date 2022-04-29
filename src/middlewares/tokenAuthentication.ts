import { Request, Response, NextFunction } from 'express';
import TokenService from '../services/TokenService';
import logger from '../utils/logger';

const tokenAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;
  if (authorization) {
    const token = authorization.substring(7);
    try {
      const user = await TokenService.verify(token);
      if (user) {
        req.authenticatedUser = user;
      }
    } catch (err) {
      logger.error(err);
    }
  }
  next();
};

export default tokenAuthentication;
