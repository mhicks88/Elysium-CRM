import express from 'express';
import cors from 'cors';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { prisma } from './db/client';

const app = express();
app.use(cors());
app.use(express.json());
app.use(loggingMiddleware);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }
    res.json({ token: 'placeholder', user: { id: user.id, email: user.email, role: user.role, organizationId: user.organizationId } });
  } catch (err) {
    next(err);
  }
});

app.get('/api/leads', requireAuth, async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany({ take: 25 });
    res.json({ data: leads });
  } catch (err) {
    next(err);
  }
});

app.use(errorHandler);

export { app };
