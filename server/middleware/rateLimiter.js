import rateLimit from 'express-rate-limit';

/**
 * 60 requests per minute per IP for all /api routes.
 */
export const apiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: 120,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: 'Too many requests — please try again in a minute.' },
});
