import { getAutomationDetails, getContactsForAutomation, getTemplateDetails, parseTemplateContent } from '@/domain/actions/activecampaign';
import { getScheduledEmails, markEmailAsSent } from '@/domain/actions/airtable';
import { createBatchEmailArray, sendBatchEmail } from '@/domain/actions/postmark';
import { sendSlackMessage } from '@/domain/actions/slack';
import { sendError, tryAction } from '@/domain/error';
import { Automation, Email, EmailSendResponse, PostmarkEmail, Template } from '@/domain/types';
import { NextRequest, NextResponse } from 'next/server';

let isPending = false;

export async function GET(request: NextRequest) {
    if (isPending) {
        console.log('[SEND] Another email send process is already running. Exiting this request.');
        return NextResponse.json({ message: 'Already Syncing' }, { status: 200 });
    }

    isPending = true;

    const emails = await tryAction<Email[]>(getScheduledEmails, 'Getting the list of ready-to-send emails');

    if (emails.length === 0) {
        console.log('[SEND] No emails to send at this time.');
        return NextResponse.json({ message: 'No emails to send.' }, { status: 200 });
    }

    for (const email of emails) {
        console.log(`\n\n[SEND] Sending email '${email["Email ID"]}'. \nSubject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);

        const automation = await tryAction<Automation>(() => getAutomationDetails(email["Automation ID"]), 'Getting automation details');

        const emails = await tryAction<string[]>(() => getContactsForAutomation(email["Automation ID"]), 'Getting the contacts from automation ' + automation.name);

        console.log(`[SEND] Found ${emails.length} contacts for automation '${automation.name}'`);

        if (emails.length === 0) {
            await sendError(`No contacts found for automation '${automation.name}'.`);
            continue;
        }

        const template = await tryAction<Template>(() => getTemplateDetails(email["Template ID"]), 'Getting template details');

        const emailContent = await tryAction(() => parseTemplateContent(template), 'Parsing template content');

        console.log(`[SEND] Got HTML content for email '${email["Email ID"]}': ${emailContent.length} characters`);

        const emailArray = await tryAction<PostmarkEmail[]>(() => createBatchEmailArray(emails, email, emailContent), 'Formatting batch email array');

        const sendResult = await tryAction<EmailSendResponse[]>(() => sendBatchEmail(emailArray), 'Sending email with Postmark');

        const successfulSends = sendResult.filter(result => result.ErrorCode === 0);

        console.log(`[SEND] Email '${email["Email ID"]}' sent successfully to ${sendResult.length}/${emails.length} recipients.`);

        const erroredSends = sendResult.filter(result => result.ErrorCode !== 0);
        const errorMessages = erroredSends.map(result => `Error sending to ${result.To}: ${result.Message}`).join('\n');

        if (erroredSends.length > 0) {
            console.error(`[SEND] Errors occurred while sending email '${email["Email ID"]}':\n${errorMessages}`);
        }

        await tryAction(() => markEmailAsSent(email["Airtable ID"]), `Marking email '${email["Email ID"]}' as sent in Airtable`);

        sendSlackMessage(`Email '${email["Email ID"]}' sent to the ${sendResult.length} recipients in '${automation.name}'.${erroredSends.length > 0 ? `\n${erroredSends.length} sends had errors.` : ''}`);

        console.log(`[SEND] Email '${email["Email ID"]}' processing completed.`);
    }

    isPending = false;

    return NextResponse.json({ status: 200 });
}