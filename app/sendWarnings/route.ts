import { clearWarnings, getEmailsThatAreWaitingOnReview, getEmailsThatAreWaitingOnSend } from "@/domain/actions/airtable";
import { sendSlackMessage } from "@/domain/actions/slack";
import { tryAction } from "@/domain/error";
import { Email } from "@/domain/types";
import console from "console";
import { NextRequest, NextResponse } from "next/server";

let isPending = false;
let lastWarned: Date | null = null;

export async function GET(request: NextRequest) {
    if (isPending) {
        console.log('[NOTIFY] Another email send process is already running. Exiting this request.');
        return NextResponse.json({ message: 'Already Testing Emails' }, { status: 429 });
    }

    isPending = true;

    await sendWarnings();

    isPending = false;

    return NextResponse.json({ status: 200 });
}

export async function sendWarnings() {
    console.log('\n\n\n\n');

    if (!lastWarned || (new Date().getTime() - lastWarned.getTime()) >= 2 * 60 * 60 * 1000) {
        await clearWarnings();  // Redo warnings every 2 hours
        lastWarned = new Date();
    }

    let emails = await tryAction<Email[]>(getEmailsThatAreWaitingOnReview, 'Getting emails that are behind on review', false);

    if (emails.length === 0) {
        console.log('[NOTIFY] No emails behind on review at this time.');
        return;
    }

    for (const email of emails) {
        try {
            console.log(`[NOTIFY] Email '${email["Email ID"]}' is behind on review. Subject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);
            await sendSlackMessage(`⚠️ Email '${email["Email ID"]}' is behind on review. \nSubject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);
        } catch (error: any) {
            console.error(`[NOTIFY] Failed to send warning for email '${email["Email ID"]}':`, error.message || error);
            // await sendError(`Failed to send warning for email '${email["Email ID"]}': \`${error.message || error}\``);
        }
    }


    emails = await tryAction<Email[]>(getEmailsThatAreWaitingOnSend, 'Getting emails that are behind on review', false);

    if (emails.length === 0) {
        console.log('[NOTIFY] No emails behind on sending at this time.');
        return;
    }

    for (const email of emails) {
        try {
            console.log(`[NOTIFY] Email '${email["Email ID"]}' should have been send. Subject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);
            await sendSlackMessage(`⚠️ Email '${email["Email ID"]}' should have been send. \nSubject: ${email.Subject} \nSchedule Date: ${email["Schedule Date"]}`);
        } catch (error: any) {
            console.error(`[NOTIFY] Failed to send warning for email '${email["Email ID"]}':`, error.message || error);
            // await sendError(`Failed to send warning for email '${email["Email ID"]}': \`${error.message || error}\``);
        }
    }
}