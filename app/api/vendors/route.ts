
// app/api/vendors/route.ts - UPDATED with POST handler
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        phone: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(vendors, { status: 200 });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to load vendor list." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, company, phone } = await req.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.vendor.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A vendor with this email already exists" },
        { status: 409 }
      );
    }

    const vendor = await prisma.vendor.create({
      data: {
        name,
        email,
        company: company || null,
        phone: phone || null,
      },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to create vendor." },
      { status: 500 }
    );
  }
}