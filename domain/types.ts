
// SLACK
export type SlackPayload = {
    message: string;
}


// AIRTABLE
export type Email = {
    "Airtable ID": string;
    "Email ID": string;
    "Template ID": string;
    "Schedule Date": string;
    "Automation ID": string;
    "Status": string;
    "Subject": string;
    "Last Modified": string;
    "Sent At": string;
}

export type AirtableEmailItem = {
    "Email ID": string;
    "Template ID": string;
    "Schedule Date": string;
    "Automation ID": string;
    "Status": string;
    "Subject": string;
    "Last Modified": string;
    "Sent At": string;
}

export type AirtableRecord<T> = {
    id: string;
    fields: T;
    createdTime: string;
}

export type AirtableResponse<T> = {
    records: AirtableRecord<T>[];
    offset?: string;
}


// ACTIVECAMPAIGN

export type AutomationLinks = {
    campaigns: string;
    contactGoals: string;
    contactAutomations: string;
    blocks: string;
    goals: string;
    sms: string;
    sitemessages: string;
    triggers: string;
};

export type Automation = {
    name: string;
    cdate: string; // ISO date string
    mdate: string; // ISO date string
    userid: string;
    status: string;
    entered: string;
    exited: string;
    hidden: string;
    entitlements_violation: string;
    source: string;
    description: string | null;
    exit_on_unsubscribe: string;
    exit_on_conversion: string;
    multientry: string;
    links: AutomationLinks;
    id: string;
};

export type AutomationResponse = {
    automation: Automation;
};

export type Template = {
    userid: string;
    ed_instanceid: string;
    ed_version: string;
    name: string;
    subject: string;
    content: string; // Large HTML string encoded in JSON
    categoryid: string;
    used: string;
    waitpreview: string;
    importnum: string;
    mdate: string; // ISO date string
    preview_content: string; // HTML content string
};

export type TemplateResponse = {
    template: Template;
};


// POSTMARK

export type PostmarkEmail = {
    From: string;
    To: string;
    Subject: string;
    TextBody: string;
    HtmlBody: string;
    MessageStream: string;
};

export type EmailSendResponse = {
    ErrorCode: number;
    Message: string;
    MessageID: string;
    SubmittedAt: string; // ISO 8601 timestamp
    To: string;
};