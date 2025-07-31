import { FROM_EMAIL, MESSAGE_STREAM } from "../settings";
import { ContactVariables, Email, EmailSendResponse, PostmarkEmail, ShortenedContact } from "../types";
import { fillContentVariables } from "./activecampaign";


const API_KEY = process.env.POSTMARK_API_KEY ?? '';

export async function createBatchEmailArray(recipients: ShortenedContact[], email: Email, htmlContent: string, variables: ContactVariables[]): Promise<PostmarkEmail[]> {
    return recipients.map(recipient => {
        let variableSet = variables.find(v => v.ID === recipient.id);
        if (!variableSet) {
            console.warn('[WARN] No variables found for contact: ' + recipient.email);
            variableSet = { ID: recipient.id, EMAIL: recipient.email, FIRSTNAME: recipient.firstName };
        }

        return {
            From: FROM_EMAIL,
            To: recipient.email,
            Subject: email.Subject,
            HtmlBody: fillContentVariables(htmlContent, variableSet),
            TextBody: '',
            MessageStream: MESSAGE_STREAM,
        }
    });
}

export async function sendBatchEmail(emails: PostmarkEmail[]): Promise<EmailSendResponse[]> {
    console.log(`[POSTMARK] Sending batch email to ${emails.length} recipients`);

    const response = await fetch('https://api.postmarkapp.com/email/batch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Postmark-Server-Token': API_KEY,
        },
        body: JSON.stringify(emails),
    });

    if (!response.ok) {
        throw new Error(`Failed to send batch email: ${response.statusText}`);
    }

    console.log(`[POSTMARK] Batch email sent successfully`);

    return response.json()
}