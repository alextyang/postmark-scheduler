import { fetchAllAirtableRecords, updateAirtableRecord } from "../api/airtable";
import { READY_TO_SEND_STATUS } from "../settings";
import { AirtableEmailItem, AirtableRecord, Email } from "../types";

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || '';


export async function getScheduledEmails(): Promise<Email[]> {
    return (await fetchAllAirtableRecords<AirtableEmailItem>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, {
        filterByFormula: `AND(AND({Status} = '${READY_TO_SEND_STATUS}', {Schedule Date} <= DATEADD(NOW(), 1, 'minute')), {Sent At} = '')`,
    })).map((record: AirtableRecord<AirtableEmailItem>) => ({
        "Airtable ID": record.id,
        ...record.fields,
    }));
}

export async function markEmailAsSent(emailId: string): Promise<void> {
    await updateAirtableRecord<any>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, emailId, {
        Status: 'Sent',
        "Sent At": new Date().toISOString(),
    });
}