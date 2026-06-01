class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  public readonly messageKey: string;
  public readonly fields: Record<string, string> | null;

  constructor(
    messageKey: string,
    statusCode: number,
    fields: Record<string, string> | null = null
  ) {
    super(messageKey);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.messageKey = messageKey;
    this.fields = fields;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
