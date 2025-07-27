import Redis from 'ioredis';

interface SessionData {
  accessToken: string;
  instanceUrl: string;
  orgId: string;
}

export class SessionService {
  private static redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: 3
  });

  static async createSession(data: SessionData): Promise<string> {
    const sessionId = this.generateSessionId();
    const expiry = 4 * 60 * 60; // 4 hours in seconds
    
    await this.redis.setex(
      `session:${sessionId}`, 
      expiry, 
      JSON.stringify(data)
    );
    
    return sessionId;
  }

  static async getSession(sessionId: string): Promise<SessionData | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  static async extendSession(sessionId: string): Promise<void> {
    const expiry = 4 * 60 * 60; // 4 hours
    await this.redis.expire(`session:${sessionId}`, expiry);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  private static generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}