import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BuilderLoginPage } from '../components/BuilderLoginPage';
import { getActiveBuilderById } from '../db/buildersRepo';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../lib/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (session?.role === 'builder') {
    let isActiveBuilder = false;
    try {
      const builder = await getActiveBuilderById(session.userId);
      isActiveBuilder = Boolean(builder);
    } catch {
      isActiveBuilder = false;
    }
    if (isActiveBuilder) {
      redirect('/dashboard');
    }
  }

  return <BuilderLoginPage initialUser={null} />;
}
