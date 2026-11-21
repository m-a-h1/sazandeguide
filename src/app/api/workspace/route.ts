import { NextRequest, NextResponse } from 'next/server';
import { getOrSeedUserWorkspace } from '../../../db/projectsRepo';
import { handleRouteError, requireAuth } from '../../../lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { auth, response } = await requireAuth(request);
  if (response || !auth) return response!;

  try {
    const workspace = await getOrSeedUserWorkspace(auth.dbUserId);
    return NextResponse.json(workspace);
  } catch (error) {
    return handleRouteError(error, 'خطا در دریافت اطلاعات.');
  }
}
