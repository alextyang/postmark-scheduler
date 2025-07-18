import { FROM_EMAIL, MESSAGE_STREAM } from "../settings";
import { Email, EmailSendResponse, PostmarkEmail } from "../types";


const API_KEY = process.env.POSTMARK_API_KEY ?? '';

export async function createBatchEmailArray(recipients: string[], email: Email, htmlContent: string): Promise<PostmarkEmail[]> {
    return recipients.map(recipient => ({
        From: FROM_EMAIL,
        To: recipient,
        Subject: email.Subject,
        HtmlBody: htmlContent,
        TextBody: '',
        MessageStream: MESSAGE_STREAM,
    }));
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