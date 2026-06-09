import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import AppError from '../utils/AppError.js';

/**
 * Generic Zod body-validation middleware.
 * Usage: router.post('/path', validateBody(myZodSchema), myController)
 */
export const validateBody = (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string> = {};
      result.error.issues.forEach(i => {
        fields[String(i.path[0])] = i.message;
      });
      return next(new AppError('ERROR_VALIDATION_FAILED', 422, fields));
    }
    req.body = result.data;
    next();
  };
