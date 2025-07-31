import { AirtableRecord, AirtableResponse } from "../types";

const AIRTABLE_API_URL = 'https://api.airtable.com/v0';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';

function getHeaders() {
    return {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
    };
}

export async function fetchAirtableRecords<T>(base: string, table: string, params: Record<string, string> = {}): Promise<AirtableResponse<T>> {
    const query = new URLSearchParams(params).toString();
    const url = `${AIRTABLE_API_URL}/${base}/${table}?${query}`;
    const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error(`Airtable fetch failed: ${res.statusText}`);
    return res.json();
}

export async function fetchAllAirtableRecords<T>(base: string, table: string, params: Record<string, string> = {}): Promise<AirtableRecord<T>[]> {
    const records = [];
    let offset: string | undefined;

    do {
        if (offset) params.offset = offset;

        const data = await fetchAirtableRecords<T>(base, table, params);
        records.push(...data.records);
        offset = data.offset;
    } while (offset);

    return records;
}

export async function fetchAirtableRecordById<T>(base: string, table: string, id: string): Promise<AirtableRecord<T>> {
    const url = `${AIRTABLE_API_URL}/${base}/${table}/${id}`;
    const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error(`Airtable fetch by ID failed: ${res.statusText}`);
    return res.json();
}

export async function createAirtableRecord(base: string, table: string, fields: Record<string, any>) {
    const url = `${AIRTABLE_API_URL}/${base}/${table}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`Airtable create failed: ${res.statusText}`);
    return res.json();
}

export async function updateAirtableRecord<T>(base: string, table: string, id: string, fields: T): Promise<AirtableRecord<T>> {
    const url = `${AIRTABLE_API_URL}/${base}/${table}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ records: [{ id, fields }], typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable update failed: ${res.statusText}`);
    return res.json();
}

export async function deleteAirtableRecord(base: string, table: string, id: string) {
    const url = `${AIRTABLE_API_URL}/${base}/${table}/${id}`;
    const res = await fetch(url, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Airtable delete failed: ${res.statusText}`);
    return res.json();
}