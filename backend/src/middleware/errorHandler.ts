import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError.js';

const globalErrorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = (err as AppError).statusCode || 500;
  const status = (err as AppError).status || 'error';

  console.error('🔥 ERROR LOG:', {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });

  if ((err as AppError).isOperational) {
    const appErr = err as AppError;
    res.status(statusCode).json({
      status,
      messageKey: appErr.messageKey,
      ...(appErr.fields && { fields: appErr.fields }),
    });
    return;
  }

  // Non-operational: don't leak internals
  res.status(500).json({
    status: 'error',
    messageKey: 'ERROR_DEFAULT',
  });
};

export default globalErrorHandler;
