import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface RouteContext {
  params: { vendorId: string } | Promise<{ vendorId: string }>;
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const resolvedParams = await context.params;
    const vendorId = resolvedParams.vendorId;

    if (!vendorId) {
      return NextResponse.json(
        { error: "Vendor ID is required" },
        { status: 400 }
      );
    }

    await prisma.vendor.delete({
      where: { id: vendorId },
    });

    return NextResponse.json(
      { status: "ok", message: "Vendor deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to delete vendor." },
      { status: 500 }
    );
  }
}
