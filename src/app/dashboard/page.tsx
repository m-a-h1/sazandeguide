import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BuilderDashboardApp } from '../../App';
import type { AuthUser } from '../../context/AuthContext';
import { getActiveBuilderById } from '../../db/buildersRepo';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../../lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session || session.role !== 'builder') {
    redirect('/');
  }

  let initialUser: AuthUser | null = null;
  try {
    const builder = await getActiveBuilderById(session.userId);
    if (builder) {
      initialUser = {
        role: 'builder',
        userId: builder.id,
        username: builder.username,
        displayName: builder.displayName,
      };
    }
  } catch {
    initialUser = null;
  }

  if (!initialUser) {
    redirect('/');
  }

  return <BuilderDashboardApp initialUser={initialUser} />;
}
