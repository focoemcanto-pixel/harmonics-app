export async function GET() {
  const apiKey = process.env.GOOGLE_MAPS_KEY || '';

  return Response.json({
    apiKey,
  });
}
