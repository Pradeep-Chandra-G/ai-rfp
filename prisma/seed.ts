import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg"; // <--- NEW IMPORT
import { Pool } from "pg"; // <--- NEW IMPORT

// Initialize the adapter setup
// NOTE: Seed script is independent, so we must manually load the DATABASE_URL environment variable
// We assume it is available in the environment when running 'npm run seed'
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Use the adapter when creating the Prisma client instance
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log(`Start seeding ...`);

  // --- 1. Create Vendors ---
  const vendors = [
    {
      name: "TechSolutions Inc.",
      email: "vendor.techsolutions@example.com",
      company: "TechSolutions",
      phone: "555-1001",
    },
    {
      name: "Office Supply Co.",
      email: "vendor.officesupply@example.com",
      company: "OfficeSupply",
      phone: "555-1002",
    },
    {
      name: "Global Devices LLC",
      email: "vendor.globaldevices@example.com",
      company: "GlobalDevices",
      phone: "555-1003",
    },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { email: v.email },
      update: {},
      create: v,
    });
  }

  const tech = await prisma.vendor.findUnique({
    where: { email: "vendor.techsolutions@example.com" },
  });
  const office = await prisma.vendor.findUnique({
    where: { email: "vendor.officesupply@example.com" },
  });
  const global = await prisma.vendor.findUnique({
    where: { email: "vendor.globaldevices@example.com" },
  });

  // --- 2. Create a Mock Structured RFP (for the Comparison test) ---
  // This is the output *after* running the /api/rfp/create endpoint
  const mockRFP = await prisma.rFP.create({
    data: {
      title: "Office Equipment Procurement (Seeded)",
      description:
        "Procurement for 20 Laptops and 15 Monitors for the new regional office.",
      budget: 50000.0,
      deadline: new Date(new Date().setMonth(new Date().getMonth() + 1)), // One month from now
      requirements: {
        title: "Office Equipment Procurement (Seeded)",
        description:
          "Procurement for 20 Laptops and 15 Monitors for the new regional office.",
        budget: 50000,
        deadline: "2026-01-01T00:00:00.000Z",
        requiredItems: [
          {
            name: "Laptop",
            quantity: 20,
            specifications: ["16GB RAM", "Core i5/Ryzen 5 minimum"],
          },
          {
            name: "Monitor",
            quantity: 15,
            specifications: ["27-inch", "4K resolution"],
          },
        ],
        paymentTerms: "Net 30",
        warranty: "2 years minimum",
      },
      status: "sent",
      rfpVendors: {
        create: [
          { vendorId: tech!.id, status: "responded" },
          { vendorId: office!.id, status: "responded" },
          { vendorId: global!.id, status: "sent" }, // Vendor who hasn't responded yet
        ],
      },
    },
  });

  // --- 3. Create two mock Proposals (for Comparison test) ---
  await prisma.proposal.create({
    data: {
      rfpId: mockRFP.id,
      vendorId: tech!.id,
      rawEmail:
        "RFP-ID: " +
        mockRFP.id +
        "\n\nWe propose the following: Total Price: $45,000. Delivery in 10 days. We offer a 3-year warranty.",
      aiScore: 90,
      aiSummary:
        "Met most requirements, offered 3-year warranty, but monitor resolution is only 1440p.",
      pricing: [
        { item: "Laptop", unitPrice: 1500, quantityOffered: 20 },
        { item: "Monitor (1440p)", unitPrice: 1000, quantityOffered: 15 },
      ],
    },
  });

  await prisma.proposal.create({
    data: {
      rfpId: mockRFP.id,
      vendorId: office!.id,
      rawEmail:
        "RFP-ID: " +
        mockRFP.id +
        "\n\nOur total price is $48,000. Delivery in 20 days. Standard 1-year warranty. All items match specifications.",
      aiScore: 98,
      aiSummary:
        "Met all specifications, but the total price is higher and the warranty is less generous.",
      pricing: [
        { item: "Laptop", unitPrice: 1600, quantityOffered: 20 },
        { item: "Monitor (4K)", unitPrice: 1066.67, quantityOffered: 15 },
      ],
    },
  });

  console.log(`Seeding finished. Created RFP ID: ${mockRFP.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
