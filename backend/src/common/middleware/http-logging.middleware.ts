import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly enabled =
    process.env.HTTP_REQUEST_LOGGING_ENABLED !== 'false';

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.enabled) {
      next();
      return;
    }

    const startedAt = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`,
      );
    });

    next();
  }
}
