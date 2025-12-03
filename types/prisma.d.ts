import { RFP, Vendor, RFPVendor, Proposal, JsonValue } from "@prisma/client";

// 1. RFP Model Type
// Represents a single RFP record fetched from the database.
type RFPModel = RFP;
/* {
    id: string;
    title: string;
    description: string;
    budget: number | null;
    deadline: Date | null;
    requirements: JsonValue; // (Stores StructuredRFP)
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
*/

// 2. Vendor Model Type
type Vendor = Vendor;
/*
{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    company: string | null;
    createdAt: Date;
}
*/

// 3. Proposal Model Type
type ProposalModel = Proposal;
/*
{
    id: string;
    rfpId: string;
    vendorId: string;
    pricing: JsonValue | null; // (Stores pricing details)
    terms: JsonValue | null;   // (Stores terms summary)
    rawEmail: string;
    attachments: JsonValue | null;
    aiScore: number | null;
    aiSummary: string | null;
    receivedAt: Date;
}
*/

// 4. RFPVendor Model Type (Join Table)
type RFPVendorModel = RFPVendor;
/*
{
    id: string;
    rfpId: string;
    vendorId: string;
    sentAt: Date;
    status: string;
}
*/
