// app/api/rfp/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Resend } from "resend";
// 💡 NEW: Import the generated Vendor type from Prisma Client
import { Prisma } from "@prisma/client";

const resend = new Resend(process.env.RESEND_API_KEY);

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
      return NextResponse.json({ error: "No vendors found" }, { status: 404 });
    }

    // 💡 FIX: Explicitly set the type of the 'vendors' array and the 'vendor' parameter.
    // The query above already returns an array of the Prisma 'Vendor' type.
    const sendPromises = (vendors as Prisma.Vendor[]).map(async (vendor: Prisma.Vendor) => {
      // OR simply: const sendPromises = vendors.map(async (vendor: Vendor) => {

      // Construct the email body using the structured RFP data
      const emailHtml = `
        <h2>Request for Proposal: ${rfp.title}</h2>
        <p>Dear ${vendor.name},</p>
        <p>${rfp.description}</p>
        <h3>Key Requirements:</h3>
        <ul>
            <li><strong>Budget:</strong> ${
        rfp.budget ? `$${rfp.budget}` : "TBD"
      }</li>
            <li><strong>Deadline:</strong> ${
        rfp.deadline ? rfp.deadline.toISOString().split("T")[0] : "TBD"
      }</li>
        </ul>
        <p>Please review the attached requirements and submit your proposal to: ${
        process.env.RESEND_INBOUND_EMAIL
      }</p>
        <p><strong>IMPORTANT:</strong> For tracking, please include the line "RFP-ID: ${
        rfp.id
      }" in the body of your reply.</p>
      `; // 1. Send the email via Resend

      const { data, error } = await resend.emails.send({
        from: "pradeepchandragajendra@schoolama.studio", // Must be a verified Resend domain
        to: vendor.email,
        subject: `RFP: ${rfp.title} - Response Required`,
        html: emailHtml,
      });

      if (error) {
        console.error(`Error sending email to ${vendor.email}:`, error);
        throw new Error(`Failed to send email to ${vendor.email}`);
      } // 2. Update the RFPVendor status to 'sent'

      await prisma.rFPVendor.upsert({
        where: { rfpId_vendorId: { rfpId: rfp.id, vendorId: vendor.id } },
        update: { status: "sent", sentAt: new Date() },
        create: { rfpId: rfp.id, vendorId: vendor.id, status: "sent" },
      });

      return data;
    });

    await Promise.all(sendPromises); // 3. Update the main RFP status

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
