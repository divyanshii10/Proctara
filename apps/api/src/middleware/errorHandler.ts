import { Request, Response, NextFunction } from 'express';
import logger from '../lib/logger';

/**
 * Global error handler middleware.
 * Catches unhandled errors and returns a consistent JSON response.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  logger.error({ err, url: req.url, method: req.method }, 'Unhandled error');

  // Prisma known errors
  if (err.name === 'PrismaClientKnownRequestError') {
    res.status(400).json({
      success: false,
      error: 'Database operation failed',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
    return;
  }

  // Validation errors (Zod)
  if (err.name === 'ZodError') {
    res.status(422).json({
      success: false,
      error: 'Validation failed',
      message: err.message,
    });
    return;
  }

  // Default 500
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.url} not found`,
  });
}
