import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export class UserController {
  
  static async register(req: Request, res: Response) {
    try {
      const { email, password, firstName, lastName } = req.body;

      // Basic validation
      if (!email || !password) {
        return res.status(400).json({ 
          error: 'Email and password are required' 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          error: 'Password must be at least 6 characters long' 
        });
      }

      const result = await AuthService.register({
        email,
        password,
        firstName,
        lastName
      });

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        token: result.token
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message === 'User already exists with this email') {
        return res.status(409).json({ error: error.message });
      }
      
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          error: 'Email and password are required' 
        });
      }

      const result = await AuthService.login({ email, password });

      res.json({
        message: 'Login successful',
        user: result.user,
        token: result.token
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      res.status(500).json({ error: 'Login failed' });
    }
  }

  static async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const user = await AuthService.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { firstName, lastName, password } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const updateData: any = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ 
            error: 'Password must be at least 6 characters long' 
          });
        }
        updateData.password = password;
      }

      const updatedUser = await AuthService.updateUser(userId, updateData);

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  static async validateToken(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        return res.json({ valid: false });
      }

      const user = await AuthService.getUserById(userId);
      
      res.json({ 
        valid: !!user,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        } : null
      });
    } catch (error) {
      console.error('Token validation error:', error);
      res.json({ valid: false });
    }
  }
}