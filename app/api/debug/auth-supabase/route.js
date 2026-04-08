import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
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
