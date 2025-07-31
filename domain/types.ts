
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

export type AutomationRun = {
    contact: string;
    seriesid: string;
    startid: string;
    status: string;
    batchid: string | null;
    adddate: string; // ISO 8601 date string
    remdate: string | null;
    timespan: string | null;
    lastblock: string;
    lastlogid: string;
    lastdate: string; // ISO 8601 date string
    in_als: string;
    completedElements: number;
    totalElements: number;
    completed: number;
    completeValue: number;
    links: Record<string, any>; // Replace `any` with a more specific type if you know the shape of `links`
    id: string;
    automation: string;
};

export type AutomationRunResponse = {
    contactAutomations: AutomationRun[];
};

export type ContactSearchResponse = {
    contacts: ShortenedContact[];
    meta: {
        total: number; // Total number of contacts found
    };
};

export type ShortenedContact = {
    cdate: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    orgid: string;
    orgname: string;
    segmentio_id: string;
    bounced_hard: string; // "0" or "1"
    bounced_soft: string; // "0" or "1"
    bounced_date: string | null;
    ip: string;
    ua: string;
    hash: string;
    socialdata_lastcheck: string | null;
    email_local: string;
    email_domain: string;
    sentcnt: string;
    rating_tstamp: string;
    gravatar: string; // "0" or "1"
    deleted: string; // "0" or "1"
    anonymized: string; // "0" or "1"
    adate: string;
    udate: string;
    edate: string;
    deleted_at: string | null;
    created_utc_timestamp: string;
    updated_utc_timestamp: string;
    created_timestamp: string;
    updated_timestamp: string;
    created_by: string;
    updated_by: string;
    mpp_tracking: string; // "0" or "1"
    last_click_date: string;
    last_open_date: string;
    last_mpp_open_date: string | null;
    best_send_hour: string;
    accountContacts: any[]; // structure not defined
    scoreValues: any[]; // structure not defined
    links: Record<string, string>; // originally "[Object]", assuming it's a key-value object
    id: string;
    organization: any | null;
}

export type Contact = {
    contactAutomations: AutomationRun[];
    contactLists: ContactList[];
    deals: unknown[]; // Replace with proper type if deals are structured
    fieldValues: FieldValue[];
    geoAddresses: GeoAddress[];
    geoIps: GeoIp[];
    contact: ContactInfo;
};

export type ContactList = {
    contact: string;
    list: string;
    form: string | null;
    seriesid: string;
    sdate: string;
    udate: string | null;
    status: string;
    responder: string;
    sync: string;
    unsubreason: string;
    campaign: string | null;
    message: string | null;
    first_name: string;
    last_name: string;
    ip4Sub: string;
    sourceid: string;
    autosyncLog: string | null;
    ip4_last: string;
    ip4Unsub: string;
    created_timestamp: string;
    updated_timestamp: string;
    created_by: string;
    updated_by: string;
    unsubscribeAutomation: string | null;
    channel: string;
    links: {
        automation: string;
        list: string;
        contact: string;
        form: string;
        autosyncLog: string;
        campaign: string;
        unsubscribeAutomation: string;
        message: string;
    };
    id: string;
    automation: string | null;
};

export type FieldValue = {
    contact: string;
    field: string;
    value: string;
    cdate: string;
    udate: string;
    created_by: string | null;
    updated_by: string | null;
    links: {
        owner: string;
        field: string;
    };
    id: string;
    owner: string;
};

export type GeoAddress = {
    ip4: string;
    country2: string;
    country: string;
    state: string;
    city: string;
    zip: string;
    area: string;
    lat: string;
    lon: string;
    tz: string;
    tstamp: string;
    links: unknown[];
    id: string;
};

export type GeoIp = {
    contact: string;
    campaignid: string;
    messageid: string;
    geoaddrid: string;
    ip4: string;
    tstamp: string;
    geoAddress: string;
    links: {
        geoAddress: string;
    };
    id: string;
};

export type ContactInfo = {
    cdate: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    orgid: string;
    orgname: string;
    segmentio_id: string;
    bounced_hard: string;
    bounced_soft: string;
    bounced_date: string | null;
    ip: string;
    ua: string;
    hash: string;
    socialdata_lastcheck: string | null;
    email_local: string;
    email_domain: string;
    sentcnt: string;
    rating_tstamp: string;
    gravatar: string;
    deleted: string;
    anonymized: string;
    adate: string;
    udate: string;
    edate: string;
    deleted_at: string | null;
    created_utc_timestamp: string;
    updated_utc_timestamp: string;
    created_timestamp: string;
    updated_timestamp: string;
    created_by: string;
    updated_by: string;
    mpp_tracking: string;
    last_click_date: string;
    last_open_date: string;
    last_mpp_open_date: string;
    best_send_hour?: string; // optional since cutoff is here
};

export type Field = {
    title: string;
    descript: string | null;
    type: string;
    isrequired: string; // "0" or "1"
    perstag: string;
    defval: string | null;
    show_in_list: string; // "0" or "1"
    rows: string; // numeric string
    cols: string; // numeric string
    visible: string; // "0" or "1"
    service: string;
    ordernum: string; // numeric string
    cdate: string; // ISO 8601 datetime
    udate: string; // ISO 8601 datetime
    options: any[]; // unknown structure, assumed array
    relations: any[]; // unknown structure, assumed array
    links: {
        options: string;
        relations: string;
    };
    id: string; // numeric string
};

export type FieldResponse = {
    fields: Field[];
    meta: {
        total: string; // numeric string
    };
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


// UTILS

export type ContactVariables = {
    ID: string;
    EMAIL: string;
    [KEY: string]: string;
    // Flexible type for contact variables
};