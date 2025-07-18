import { SlackPayload } from "../types";

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

export async function sendSlackMessage(message: string): Promise<void> {
    if (!WEBHOOK_URL) {
        return console.log('SLACK_WEBHOOK_URL is not defined in environment variables');
    }

    const payload: SlackPayload = { message };

    const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        return console.log(`Slack webhook POST failed: ${response.status} ${response.statusText}`);
    }
}