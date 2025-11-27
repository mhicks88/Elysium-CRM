import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/client';
import { env } from '../../config/env';
import { User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: string;
  organizationId: string;
  email: string;
}

class AuthService {
  async validateCredentials(email: string, password: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });
    if (!user || !user.isActive) {
      return null;
    }
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }
    return user;
  }

  issueToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        role: user.role,
        organizationId: user.organizationId,
        email: user.email
      },
      env.jwtSecret,
      { expiresIn: '12h' }
    );
  }

  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
      const user = await prisma.user.findUnique({ where: { id: decoded.sub } });
      if (!user || !user.isActive) {
        return null;
      }
      return user;
    } catch (err) {
      return null;
    }
  }
}

export const authService = new AuthService();
