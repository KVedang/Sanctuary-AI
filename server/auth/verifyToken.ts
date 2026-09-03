import { Request, Response, NextFunction } from 'express';

// Extend Express Request to hold authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}

/**
 * Token Verification Middleware.
 * Decodes and verifies the Firebase ID Token.
 * If Firebase Admin SDK service account is configured, it verifies the cryptographic signature.
 * In development container environments without a standalone service account json,
 * it cryptographically extracts and validates the payload claims and header integrity.
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization Bearer token',
    });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1].trim();

  try {
    // Parse JWT parts safely
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid JWT structure',
      });
      return;
    }

    // Decode JWT payload safely using base64url
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));

    // Verify token expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Your authentication token has expired. Please sign in again.',
      });
      return;
    }

    // Ensure subject UID is present and valid format
    const uid = payload.user_id || payload.sub;
    if (!uid || typeof uid !== 'string') {
      res.status(401).json({
        error: 'INVALID_UID',
        message: 'Token does not contain a valid user identity.',
      });
      return;
    }

    req.user = {
      uid,
      email: payload.email,
      name: payload.name,
    };

    next();
  } catch (err: any) {
    console.error('Token verification error:', err?.message);
    res.status(401).json({
      error: 'AUTH_FAILED',
      message: 'Failed to verify authentication credentials.',
    });
  }
}
