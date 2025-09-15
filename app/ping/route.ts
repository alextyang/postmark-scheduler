import { NextRequest, NextResponse } from 'next/server';

const APP_URL = process.env.APP_URL;

export async function GET(request: NextRequest) {

    fetch(APP_URL + '/updateMetadata');
    fetch(APP_URL + '/testEmails');
    fetch(APP_URL + '/sendEmails');
    fetch(APP_URL + '/sendWarnings');

    return NextResponse.json({ status: 200 });
}