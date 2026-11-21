import { cookies } from 'next/headers';
import { SuperAdminPageClient } from '../../components/SuperAdminPageClient';
import type { AuthUser } from '../../context/AuthContext';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../../lib/session';

export const dynamic = 'force-dynamic';

export default async function SuperAdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  const initialUser: AuthUser | null =
    session?.role === 'superadmin' ? session : null;

  return <SuperAdminPageClient initialUser={initialUser} />;
}
