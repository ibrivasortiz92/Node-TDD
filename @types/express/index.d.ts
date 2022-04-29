declare namespace Express {
  export interface Request {
    pagination?: { page: number; size: number };
    authenticatedUser?: { id: number };
  }
}
