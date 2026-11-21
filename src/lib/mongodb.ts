import mongoose from 'mongoose';

export class DatabaseConfigError extends Error {
  statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.__mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!globalThis.__mongooseCache) {
  globalThis.__mongooseCache = cached;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri || uri === 'MY_MONGODB_URI') {
    throw new DatabaseConfigError(
      'نشانی اتصال به پایگاه داده در تنظیمات محیطی سامانه وارد نشده است.'
    );
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000,
      })
      .then((m) => m)
      .catch((err) => {
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
