import { fetchAllAirtableRecords, updateAirtableRecord } from "../api/airtable";
import { DRAFT_STATUS, READY_TO_SEND_STATUS, READY_TO_TEST_STATUS, SENT_STATUS, TESTED_STATUS } from "../settings";
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

export async function getTestEmails(): Promise<Email[]> {
    return (await fetchAllAirtableRecords<AirtableEmailItem>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, {
        filterByFormula: `{Status} = '${READY_TO_TEST_STATUS}'`,
    })).map((record: AirtableRecord<AirtableEmailItem>) => ({
        "Airtable ID": record.id,
        ...record.fields,
    }));
}

export async function markEmailAsTested(emailId: string): Promise<void> {
    await updateAirtableRecord<any>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, emailId, {
        Status: TESTED_STATUS,
    });
}

export async function markEmailAsSent(emailId: string): Promise<void> {
    await updateAirtableRecord<any>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, emailId, {
        Status: SENT_STATUS,
        "Sent At": new Date().toISOString(),
    });
}



export async function getEmailsThatNeedMetadataUpdate(): Promise<Email[]> {
    return (await fetchAllAirtableRecords<AirtableEmailItem>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, {
        filterByFormula: `AND({Status} != '${DRAFT_STATUS}', AND({Status} != '${SENT_STATUS}', OR(IS_AFTER({Email Last Modified}, {Metadata Last Populated}), {Metadata Last Populated} = BLANK())))`,
    })).map((record: AirtableRecord<AirtableEmailItem>) => ({
        "Airtable ID": record.id,
        ...record.fields,
    }));
}

export async function saveMetadata(emailId: string, automationName: string, templateName: string) {
    await updateAirtableRecord<any>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, emailId, {
        "Automation Name": automationName,
        "Template Name": templateName
    });
}

export async function getEmailsThatAreWaitingOnReview(): Promise<Email[]> {
    return (await fetchAllAirtableRecords<AirtableEmailItem>(AIRTABLE_BASE_ID, AIRTABLE_TABLE_ID, {
        filterByFormula: `AND({Status} = '${TESTED_STATUS}', {Schedule Date} <= DATEADD(NOW(), 1, 'minute'))`,
    })).map((record: AirtableRecord<AirtableEmailItem>) => ({
        "Airtable ID": record.id,
        ...record.fields,
    }));
}