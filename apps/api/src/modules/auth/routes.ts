import { Router } from 'express';
import { z } from 'zod';
import { authService } from './service';
import { requireAuth, AuthenticatedRequest } from '../../middleware/auth';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Email and password are required' } });
      return;
    }

    const { email, password } = parsed.data;
    const user = await authService.validateCredentials(email, password);
    if (!user) {
      console.log(JSON.stringify({ level: 'warn', message: 'Invalid login attempt', email }));
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const token = authService.issueToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Missing or invalid token' } });
    return;
  }
  res.json({ user: req.user });
});

export { router as authRoutes };
