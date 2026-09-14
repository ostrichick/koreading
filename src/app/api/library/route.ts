import { NextRequest, NextResponse } from 'next/server';
import { listQuerySchema, publicArticlePage } from '@/lib/server/publicArticles';
export async function GET(req: NextRequest) {
  const parsed = listQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid filters' }, { status: 400 });
  try { return NextResponse.json(await publicArticlePage(parsed.data)); }
  catch { return NextResponse.json({ error: 'Unable to load library. Please retry.' }, { status: 503 }); }
}
