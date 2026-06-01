import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError.js';

type Role = 'DOCTOR' | 'LAB_TECH' | 'MANAGER';

export const requireRole = (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('ERROR_UNAUTHORIZED', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('ERROR_FORBIDDEN', 403));
    }
    next();
  };
