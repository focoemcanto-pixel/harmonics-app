// app/api/debug/full/route.js
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    
    console.error('[DEBUG-FULL] Cookies recebidas:', {
      total: allCookies.length,
      names: allCookies.map(c => c.name),
    });

    // Tentar obter usuário
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    console.error('[DEBUG-FULL] Auth:', {
      hasUser: !!user,
      hasSession: !!session,
      userError: userError?.message,
      sessionError: sessionError?.message,
    });

    return NextResponse.json({
      environment: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      cookies: {
        total: allCookies.length,
        list: allCookies.map(c => ({
          name: c.name,
          valueLength: c.value.length,
          hasSupabasePrefix: c.name.includes('sb-'),
        })),
      },
      auth: {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        hasSession: !!session,
        userError: userError?.message,
        sessionError: sessionError?.message,
      },
      request: {
        headers: {
          'user-agent': request.headers.get('user-agent'),
          'referer': request.headers.get('referer'),
          'cookie-count': request.headers.get('cookie')?.split(';').length || 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    });
  }
}
