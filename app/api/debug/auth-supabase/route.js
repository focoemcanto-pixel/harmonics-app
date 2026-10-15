import { NextResponse } from 'next/server';
import { guardDebugRoute } from '@/lib/api/route-guards';
import { createClient } from '@/lib/supabase/server';

export async function GET(request) {
  const guard = await guardDebugRoute(request);
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    userExists: !!user,
    userId: user?.id,
    userEmail: user?.email,
    error: error?.message,
  });
}
