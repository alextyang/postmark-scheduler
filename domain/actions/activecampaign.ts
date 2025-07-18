import { FETCH_DELAY_SEC } from "../settings";
import { Automation, AutomationResponse, Template, TemplateResponse } from "../types";

const API_URL = process.env.ACTIVECAMPAIGN_API_URL ?? '';
const API_KEY = process.env.ACTIVECAMPAIGN_API_KEY ?? '';


export async function parseTemplateContent(template: Template): Promise<string> {
    try {
        // Attempt to parse the content as JSON
        const parsed = JSON.parse(template.content);
        if (parsed.html) {
            return parsed.html; // Return HTML content if available
        }
    } catch (error: any) {
        console.log(`[ERROR] Failed to parse template content for ID ${template.userid}. Reverting to preview content. `, error);
    }

    return template.preview_content; // Return preview content if available
}

export async function getTemplateDetails(templateId: string): Promise<Template> {
    console.log(`[AC] Fetching template contents for ID: ${templateId}`);

    return (await fetch(`${API_URL}/templates/${templateId}`, {
        headers: {
            "Content-Type": "application/json",
            "Api-Token": API_KEY,
        },
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching template contents: ${response.statusText}`);
            }
            return response.json() as Promise<TemplateResponse>;
        })).template as Template;

}

export async function getAutomationDetails(automationID: string): Promise<Automation> {
    console.log(`[AC] Fetching automation details for ID: ${automationID}`);

    return (await fetch(`${API_URL}/automations/${automationID}`, {
        headers: {
            "Content-Type": "application/json",
            "Api-Token": API_KEY,
        },
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching automation details: ${response.statusText}`);
            }
            return response.json() as Promise<AutomationResponse>;
        })).automation as Automation;
}

export async function getContactsForAutomation(automationId: string): Promise<string[]> {
    console.log(`[AC] Fetching contacts for automation ID: ${automationId}`);

    let emails: any[] = [];
    let nextOffset = 0;
    let total = 0;
    let limit = 50; // Adjust limit as needed

    do {
        if (nextOffset)
            console.log(`[AC] Fetching next batch of contacts (${emails.length}/${total})`);

        const queryParams = new URLSearchParams({
            offset: nextOffset.toString(),
            limit: limit.toString(),
            seriesid: automationId,
        });

        const data = await fetch(API_URL + '/contacts?' + queryParams, {
            headers: {
                "Content-Type": "application/json",
                "Api-Token": API_KEY,
            },
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error fetching contacts for automation: ${response.statusText}`);
                }
                return response.json();
            });

        emails = emails.concat(data.contacts.map((contact: any) => contact.email));

        total = data.meta.total;
        nextOffset += limit;

        console.log(`[AC] Fetched ${emails.length} contacts.`);

        await new Promise(resolve => setTimeout(resolve, FETCH_DELAY_SEC * 1000)); // Throttle requests to avoid hitting API limits

    } while (nextOffset < total);

    return emails;
}