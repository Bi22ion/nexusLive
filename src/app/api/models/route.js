import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const userId = process.env.STRIPCASH_USER_ID;
    const apiBase = process.env.STRIPCASH_API_BASE || 'https://go.whitetrafsa.com/api';

    if (!userId) {
      return NextResponse.json({ error: 'STRIPCASH_USER_ID is missing' }, { status: 500 });
    }

    const res = await fetch(`${apiBase}/models/online?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error('Failed to fetch models from Stripcash API');
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
