import { Request, Response, NextFunction } from 'express';

const wrapAsync =
  (fn: (req: Request, res: Response) => Promise<Response>) => (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export default wrapAsync;
