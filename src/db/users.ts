import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName = ''
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          displayName,
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('خطا در همگام‌سازی اطلاعات کاربر با پایگاه داده.', {
      cause: error,
    });
  }
}
