import { getActiveContactsInAutomation, getAllContactVariables, getAutomationDetails, getTemplateDetails, listFields, parseTemplateContent } from '@/domain/actions/activecampaign';
import { getEmailsThatAreWaitingOnReview, getEmailsThatNeedMetadataUpdate, getScheduledEmails, getTestEmails, markEmailAsSent, markEmailAsTested, saveMetadata } from '@/domain/actions/airtable';
import { createBatchEmailArray, sendBatchEmail } from '@/domain/actions/postmark';
import { sendSlackMessage } from '@/domain/actions/slack';
import { sendError, tryAction } from '@/domain/error';
import { TEST_AUTOMATION } from '@/domain/settings';
import { Automation, Email, EmailSendResponse, PostmarkEmail, Template } from '@/domain/types';
import { NextRequest, NextResponse } from 'next/server';

let isPending = false;

export async function GET(request: NextRequest) {
    if (isPending) {
        console.log('[SEND] Another email send process is already running. Exiting this request.');
        return NextResponse.json({ message: 'Already Syncing' }, { status: 200 });
    }

    isPending = true;

    await updateDisplayMetadata();
    await testEmails();
    await sendEmails();
    await sendWarnings();

    isPending = false;

    return NextResponse.json({ status: 200 });
}

async function updateDisplayMetadata() {
    console.log('\n\n\n\n');
    const emails = await tryAction<Email[]>(getEmailsThatNeedMetadataUpdate, 'Checking for emails that need new display data');

    if (emails.length === 0)
        return;

    for (const email of emails) {
        try {
            console.log('\n\n[METADATA] Updating metadata for ' + email['Email ID']);

            const automation = await tryAction<Automation>(() => getAutomationDetails(email["Automation ID"]), 'Getting automation details');

            const template = await tryAction<Template>(() => getTemplateDetails(email["Template ID"]), 'Getting template details');

            const automationName = automation.name;
            const templateName = template.name;

            await saveMetadata(email['Airtable ID'], automationName, templateName);
        } catch (error: any) {
            console.error(`[METADATA] Failed to update metadata for email '${email['Email ID']}':`, error.message || error);
            await sendError(`Failed to update metadata for email '${email['Email ID']}': \`${error.message || error}\``);
        }
    }
}


async function testEmails() {
    console.log('\n\n\n\n');
    const emails = await tryAction<Email[]>(getTestEmails, 'Getting the list of ready-to-test emails');

    if (emails.length === 0) {
        console.log('[TEST] No emails to test at this time.');
        return;
    }

    const fields = await tryAction(() => listFields(), 'Listing ActiveCampaign fields');
    console.log(`[TEST] Found ${fields.length} ActiveCampaign fields.`);

    for (const email of emails) {
        try {

            console.log(`\n\n[TEST] Sending email '${email["Email ID"]}'. \nSubject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);
            email["Automation ID"] = TEST_AUTOMATION;
            const sendDate = new Date(email["Schedule Date"]);

            const hours = sendDate.getHours();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const hours12 = hours % 12 === 0 ? 12 : hours % 12;
            let sendDateStr = `${sendDate.getMonth() + 1}-${sendDate.getDate()} ${hours12}${ampm}`;

            if (sendDate < new Date())
                sendDateStr = `ASAP`;

            email.Subject = `TEST: [${sendDateStr}] ${email.Subject}`;

            const automation = await tryAction<Automation>(() => getAutomationDetails(TEST_AUTOMATION), 'Getting automation details');

            const automationContacts = await tryAction(() => getActiveContactsInAutomation(TEST_AUTOMATION), 'Getting active contacts for automation');

            if (automationContacts.length === 0) {
                await sendError(`No active contacts found in automation '${automation.name}'.`);
                continue;
            }

            const template = await tryAction<Template>(() => getTemplateDetails(email["Template ID"]), 'Getting template details');

            let emailContent = await tryAction(() => parseTemplateContent(template), 'Parsing template content');

            console.log(`[TEST] Got HTML content for email '${email["Email ID"]}': ${emailContent.length} characters`);

            const variables = await tryAction(() => getAllContactVariables(automationContacts, fields), 'Getting all contact variables');

            const emailArray = await tryAction<PostmarkEmail[]>(() => createBatchEmailArray(automationContacts, email, emailContent, variables), 'Formatting batch email array');

            const sendResult = await tryAction<EmailSendResponse[]>(() => sendBatchEmail(emailArray), 'Sending email with Postmark');

            const successfulSends = sendResult.filter(result => result.ErrorCode === 0);
            console.log(`[TEST] Email '${email["Email ID"]}' sent successfully to ${successfulSends.length}/${automationContacts.length} recipients.`);

            const erroredSends = sendResult.filter(result => result.ErrorCode !== 0);
            const errorMessages = erroredSends.map(result => `Error sending to ${result.To}: ${result.Message}`).join('\n');

            if (erroredSends.length > 0) {
                console.error(`[TEST] Errors occurred while testing email '${email["Email ID"]}':\n${errorMessages}`);
            }

            await tryAction(() => markEmailAsTested(email["Airtable ID"]), `Marking email '${email["Email ID"]}' as tested in Airtable`);

            console.log(`[TEST] Email '${email["Email ID"]}' processing completed.`);
        } catch (error: any) {
            console.error(`[TEST] Failed to send test email '${email["Email ID"]}':`, error.message || error);
            await sendError(`Failed to send test email '${email["Email ID"]}': \`${error.message || error}\``);
        }
    }
}

async function sendEmails() {
    console.log('\n\n\n\n');
    const emails = await tryAction<Email[]>(getScheduledEmails, 'Getting the list of ready-to-send emails');

    if (emails.length === 0) {
        console.log('[SEND] No emails to send at this time.');
        return NextResponse.json({ message: 'No emails to send.' }, { status: 200 });
    }

    const fields = await tryAction(() => listFields(), 'Listing ActiveCampaign fields');
    console.log(`[SEND] Found ${fields.length} ActiveCampaign fields.`);

    for (const email of emails) {
        try {
            console.log(`\n\n[SEND] Sending email '${email["Email ID"]}'. \nSubject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);

            const automation = await tryAction<Automation>(() => getAutomationDetails(email["Automation ID"]), 'Getting automation details');

            const automationContacts = await tryAction(() => getActiveContactsInAutomation(email["Automation ID"]), 'Getting active contacts for automation');

            if (automationContacts.length === 0) {
                await sendError(`No active contacts found in automation '${automation.name}'.`);
                continue;
            }

            const template = await tryAction<Template>(() => getTemplateDetails(email["Template ID"]), 'Getting template details');

            let emailContent = await tryAction(() => parseTemplateContent(template), 'Parsing template content');

            console.log(`[SEND] Got HTML content for email '${email["Email ID"]}': ${emailContent.length} characters`);

            const variables = await tryAction(() => getAllContactVariables(automationContacts, fields), 'Getting all contact variables');

            const emailArray = await tryAction<PostmarkEmail[]>(() => createBatchEmailArray(automationContacts, email, emailContent, variables), 'Formatting batch email array');

            const sendResult = await tryAction<EmailSendResponse[]>(() => sendBatchEmail(emailArray), 'Sending email with Postmark');

            const successfulSends = sendResult.filter(result => result.ErrorCode === 0);
            console.log(`[SEND] Email '${email["Email ID"]}' sent successfully to ${successfulSends.length}/${automationContacts.length} recipients.`);

            const erroredSends = sendResult.filter(result => result.ErrorCode !== 0);
            const errorMessages = erroredSends.map(result => `Error sending to ${result.To}: ${result.Message}`).join('\n');

            if (erroredSends.length > 0) {
                console.error(`[SEND] Errors occurred while sending email '${email["Email ID"]}':\n${errorMessages}`);
            }

            await tryAction(() => markEmailAsSent(email["Airtable ID"]), `Marking email '${email["Email ID"]}' as sent in Airtable`);

            sendSlackMessage(`Email '${email["Email ID"]}' successfully sent to ${sendResult.length}/${automationContacts.length} recipients in '${automation.name}'.${erroredSends.length > 0 ? `\n${erroredSends.length} sends had errors.` : ''}`);

            console.log(`[SEND] Email '${email["Email ID"]}' processing completed.`);
        } catch (error: any) {
            console.error(`[SEND] Failed to send email '${email["Email ID"]}':`, error.message || error);
            await sendError(`Failed to send email '${email["Email ID"]}': \`${error.message || error}\``);
        }
    }
}

async function sendWarnings() {
    console.log('\n\n\n\n');
    const emails = await tryAction<Email[]>(getEmailsThatAreWaitingOnReview, 'Getting emails that are waiting on review');

    if (emails.length === 0) {
        console.log('[WARN] No emails waiting for review at this time.');
        return;
    }

    for (const email of emails) {
        try {
            console.log(`[WARN] Email '${email["Email ID"]}' is waiting for review. Subject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);
            await sendSlackMessage(`⚠️ Email '${email["Email ID"]}' is waiting for review. Subject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);
        } catch (error: any) {
            console.error(`[WARN] Failed to send warning for email '${email["Email ID"]}':`, error.message || error);
            await sendError(`Failed to send warning for email '${email["Email ID"]}': \`${error.message || error}\``);
        }
    }
}