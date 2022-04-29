import { Request, Response, NextFunction } from 'express';
import ValidationException from '../exceptions/ValidationException';

const ErrorHandler = (err: ValidationException, req: Request, res: Response, next: NextFunction) => {
  const { message, status } = err;
  let validationErrors: { [field: string]: string } | undefined = undefined;

  if (err instanceof ValidationException) {
    validationErrors = {};
    err.errors.forEach((element: { param: string; msg: string }) => {
      validationErrors = {
        ...validationErrors,
        [element.param]: req.t(element.msg),
      };
    });
  }

  return res.status(status).send({
    path: req.originalUrl,
    timestamp: new Date().getTime(),
    message: req.t(message),
    validationErrors: validationErrors ? validationErrors : undefined,
  });

  next();
};

export default ErrorHandler;
