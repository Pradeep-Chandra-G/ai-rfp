import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Ensure we return a 200 status with the data
    return NextResponse.json(vendors, { status: 200 });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to load vendor list." },
      { status: 500 }
    );
  }
}
