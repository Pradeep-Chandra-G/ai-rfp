// app/api/rfp/route.ts - FINAL, COMPLETE VERSION

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Resend } from "resend";
import { Vendor } from "@/types/index"; // Ensure this import is correct

const resend = new Resend(process.env.RESEND_API_KEY);

// --- 1. GET Handler (Fetch All RFPs for Dashboard) ---
export async function GET() {
    try {
        const rfps = await prisma.rFP.findMany({
            include: {
                proposals: {
                    select: { id: true },
                },
                rfpVendors: {
                    select: { vendorId: true },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        const frontendRfps = rfps.map(rfp => ({
            id: rfp.id,
            title: rfp.title,
            status: rfp.status as 'draft' | 'sent' | 'responded' | 'completed',
            budget: rfp.budget,
            deadline: rfp.deadline ? rfp.deadline.toISOString() : null,
            vendorCount: rfp.rfpVendors.length,
            proposalCount: rfp.proposals.length,
            aiScore: null,
        }));

        return NextResponse.json(frontendRfps, { status: 200 });

    } catch (error) {
        console.error("Critical Database Error fetching RFPs:", error);
        return NextResponse.json(
            { status: "error", message: "Database query failed. Check server logs." },
            { status: 500 }
        );
    }
}


// ------------------------------------------------------------------
// --- 2. POST Handler (Send RFP Logic) ---
// This handles the POST request from the SendRFPButton to /api/rfp
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
    try {
        const { rfpId, vendorIds } = await req.json();

        if (!rfpId || !vendorIds || vendorIds.length === 0) {
            return NextResponse.json(
                { error: "Missing RFP ID or Vendor IDs" },
                { status: 400 }
            );
        }

        const rfp = await prisma.rFP.findUnique({
            where: { id: rfpId },
            include: { rfpVendors: true, proposals: true },
        });

        if (!rfp) {
            return NextResponse.json({ error: "RFP not found" }, { status: 404 });
        }

        const vendors = await prisma.vendor.findMany({
            where: { id: { in: vendorIds } },
        });

        if (vendors.length === 0) {
            // This is the error you saw before ("No vendors found")
            return NextResponse.json({ error: "No vendors found" }, { status: 404 }); 
        }

        const sendPromises = (vendors as Vendor[]).map(async (vendor: Vendor) => {
            
            const emailHtml = `
                <h2>Request for Proposal: ${rfp.title}</h2>
                <p>Dear ${vendor.name},</p>
                <p>${rfp.description}</p>
                <h3>Key Requirements:</h3>
                <ul>
                    <li><strong>Budget:</strong> ${rfp.budget ? `$${rfp.budget}` : "TBD"}</li>
                    <li><strong>Deadline:</strong> ${rfp.deadline ? rfp.deadline.toISOString().split("T")[0] : "TBD"}</li>
                </ul>
                <p>Please review the attached requirements and submit your proposal to: ${process.env.RESEND_INBOUND_EMAIL}</p>
                <p><strong>IMPORTANT:</strong> For tracking, please include the line "RFP-ID: ${rfp.id}" in the body of your reply.</p>
            `;

            const { data, error } = await resend.emails.send({
                from: "pradeepchandragajendra@schoolama.studio",
                to: vendor.email,
                subject: `RFP: ${rfp.title} - Response Required`,
                html: emailHtml,
            });

            if (error) {
                console.error(`Error sending email to ${vendor.email}:`, error);
                throw new Error(`Failed to send email to ${vendor.email}`);
            }

            await prisma.rFPVendor.upsert({
                where: { rfpId_vendorId: { rfpId: rfp.id, vendorId: vendor.id } },
                update: { status: "sent", sentAt: new Date() },
                create: { rfpId: rfp.id, vendorId: vendor.id, status: "sent" },
            });

            return data;
        });

        await Promise.all(sendPromises);

        await prisma.rFP.update({
            where: { id: rfpId },
            data: { status: "sent" },
        });

        return NextResponse.json(
            {
                status: "ok",
                message: `RFP sent successfully to ${vendors.length} vendor(s).`,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("RFP Sending Error:", error);
        return NextResponse.json(
            {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        );
    }
}