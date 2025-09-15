import { getAutomationDetails, getTemplateDetails } from "@/domain/actions/activecampaign";
import { getEmailsThatNeedMetadataUpdate, saveMetadata } from "@/domain/actions/airtable";
import { tryAction } from "@/domain/error";
import { Automation, Email, Template } from "@/domain/types";
import console from "console";
import { NextRequest, NextResponse } from "next/server";

let isPending = false;

export async function GET(request: NextRequest) {
    if (isPending) {
        console.log('[METADATA] Another email send process is already running. Exiting this request.');
        return NextResponse.json({ message: 'Already Updating Display Metadata' }, { status: 429 });
    }

    isPending = true;

    await updateDisplayMetadata();

    isPending = false;

    return NextResponse.json({ status: 200 });
}

export async function updateDisplayMetadata() {
    console.log('\n\n\n\n');
    const emails = await tryAction<Email[]>(getEmailsThatNeedMetadataUpdate, 'Checking for emails that need new display data', false);

    if (emails.length === 0)
        return;

    for (const email of emails) {
        try {
            console.log('\n\n[METADATA] Updating metadata for ' + email['Email ID']);

            const automation = await tryAction<Automation>(() => getAutomationDetails(email["Automation ID"]), 'Getting automation details', false);

            const template = await tryAction<Template>(() => getTemplateDetails(email["Template ID"]), 'Getting template details', false);

            const automationName = automation.name;
            const templateName = template.name;

            await saveMetadata(email['Airtable ID'], automationName, templateName);
        } catch (error: any) {
            console.error(`[METADATA] Failed to update metadata for email '${email['Email ID']}':`, error.message || error);
            // await sendError(`Failed to update metadata for email '${email['Email ID']}': \`${error.message || error}\``);
        }
    }
}