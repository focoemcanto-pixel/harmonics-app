export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request, context) {
  const resolvedParams = await context?.params;
  const token = String(resolvedParams?.token || '').trim();

  const { searchParams } = new URL(request.url);
  const debugKey = searchParams.get('debugKey');

  if (debugKey !== process.env.DEBUG_INTERNAL_KEY) {
    return Response.json({ ok: false, code: 'UNAUTHORIZED_DEBUG' }, { status: 401 });
  }

  return Response.json({
    ok: true,
    route: 'debug-contract-pdf',
    token,
    hasDebugKeyEnv: Boolean(process.env.DEBUG_INTERNAL_KEY),
  });
}
