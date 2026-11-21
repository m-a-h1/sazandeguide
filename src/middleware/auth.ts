import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUserId?: number;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'برای انجام این عملیات باید وارد حساب کاربری شوید.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const dbUser = await getOrCreateUser(
      decodedToken.uid,
      decodedToken.email ?? '',
      decodedToken.name ?? ''
    );
    req.dbUserId = dbUser.id;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'نشست کاربری معتبر نیست. لطفاً دوباره وارد شوید.' });
  }
};
