import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();
  res.on('finish', () => {
    const duration = Math.round(performance.now() - start);
    const log = {
      level: 'info',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: duration
    };
    console.log(JSON.stringify(log));
  });
  next();
}
