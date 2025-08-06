const jwt = require('jsonwebtoken');

interface TokenPayload {
  userId: string;
  email: string;
}

export class JWTUtils {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development-only';
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

  static generateToken(payload: TokenPayload): string {
    const secret = this.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    
    return jwt.sign(
      { userId: payload.userId, email: payload.email },
      secret,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  static verifyToken(token: string): TokenPayload | null {
    try {
      const secret = this.JWT_SECRET;
      if (!secret) {
        return null;
      }
      
      const decoded = jwt.verify(token, secret);
      return decoded as TokenPayload;
    } catch (error) {
      return null;
    }
  }
}