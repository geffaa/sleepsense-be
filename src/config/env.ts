import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '0.0.0.0',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'sleepsense',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'c13775bbc3dc5a966bd1ba1238bb7502abb4491930ef5ff8d520fd974db509c2c2dd7c754aa7d68826f121c7c7d9b98f0d636e9c22a57e58e9ae383f3c9a2951',
    expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any,
  },
};