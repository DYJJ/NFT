import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const uri = searchParams.get('uri');
    
    if (!uri) {
        return NextResponse.json({ error: 'No URI provided' }, { status: 400 });
    }

    try {
        const response = await fetch(uri);
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching metadata:', error);
        return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
    }
} 