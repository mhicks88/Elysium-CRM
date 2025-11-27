import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const details = err.details;
  const response = { error: { code: err.code || 'INTERNAL_ERROR', message, details } };
  console.error(JSON.stringify({ level: 'error', message, stack: err.stack }));
  res.status(status).json(response);
}
