import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'changeme',
  dialer: {
    genericBaseUrl: process.env.DIALER_GENERIC_BASE_URL || '',
    genericApiKey: process.env.DIALER_GENERIC_API_KEY || '',
    webhookSecret: process.env.DIALER_WEBHOOK_SECRET || ''
  }
};

if (!env.databaseUrl) {
  console.warn('DATABASE_URL is not set. Prisma will fail to connect.');
}
