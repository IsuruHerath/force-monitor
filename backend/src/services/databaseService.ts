import { PrismaClient } from '@prisma/client';

class DatabaseService {
  private static instance: PrismaClient;

  static getInstance(): PrismaClient {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      });
    }
    return DatabaseService.instance;
  }

  static async connect() {
    try {
      const prisma = this.getInstance();
      await prisma.$connect();
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  static async disconnect() {
    try {
      const prisma = this.getInstance();
      await prisma.$disconnect();
      console.log('Database disconnected');
    } catch (error) {
      console.error('Database disconnection failed:', error);
    }
  }

  static async healthCheck() {
    try {
      const prisma = this.getInstance();
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export { DatabaseService };
export const prisma = DatabaseService.getInstance();