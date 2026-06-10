import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import sql from '../config/db.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

export interface JwtPayload {
  user_id: string;
  org_id:  string | null;
  role:    'DOCTOR' | 'LAB_TECH' | 'MANAGER';
  jti:     string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = catchAsync(
  async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new AppError('ERROR_UNAUTHORIZED', 401));
    }

    const token = authHeader.split(' ')[1];

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
    } catch {
      return next(new AppError('ERROR_TOKEN_INVALID', 401));
    }

    // Check token is not blacklisted
    const blacklisted = await sql`
      SELECT jti FROM token_blacklist
      WHERE jti = ${decoded.jti} AND expires_at > NOW()
    `;
    if (blacklisted.length > 0) {
      return next(new AppError('ERROR_TOKEN_REVOKED', 401));
    }

    // Check user status (active and not deleted)
    const [userRecord] = await sql`
      SELECT status, deleted_at FROM users
      WHERE user_id = ${decoded.user_id}
      LIMIT 1
    `;

    if (!userRecord || userRecord.deleted_at !== null) {
      return next(new AppError('ERROR_USER_NOT_FOUND', 401));
    }

    if (userRecord.status !== 'ACTIVE') {
      return next(new AppError('ERROR_ACCOUNT_INACTIVE', 403));
    }

    req.user = decoded;
    next();
  }
);
