import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { JWTUtils } from '../utils/jwtUtils';

const prisma = new PrismaClient();

interface TokenPayload {
  userId: string;
  email: string;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;

  static async register(userData: RegisterData) {
    const { email, password, firstName, lastName } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true
      }
    });

    // Generate JWT token
    const token = JWTUtils.generateToken({ userId: user.id, email: user.email });

    return {
      user,
      token
    };
  }

  static async login(credentials: LoginCredentials) {
    const { email, password } = credentials;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token
    const token = JWTUtils.generateToken({ userId: user.id, email: user.email });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      token
    };
  }

  static async validateToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = JWTUtils.verifyToken(token);
      if (!decoded) {
        return null;
      }
      
      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  static async getUserById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        organizations: {
          select: {
            id: true,
            name: true,
            orgId: true,
            environment: true,
            isActive: true,
            lastSync: true
          }
        }
      }
    });
  }

  static async updateUser(userId: string, updateData: Partial<RegisterData>) {
    const data: any = {};
    
    if (updateData.firstName !== undefined) data.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) data.lastName = updateData.lastName;
    if (updateData.password) {
      data.password = await bcrypt.hash(updateData.password, this.SALT_ROUNDS);
    }

    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        updatedAt: true
      }
    });
  }

}