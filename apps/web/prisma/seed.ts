import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// Create Supabase admin client for creating auth users
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper function to create a user in Supabase auth (trigger creates User record)
async function createAuthUser(
  email: string,
  name: string,
  password: string = "password123"
): Promise<string> {
  // Check if user already exists in auth
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === email);

  if (existingUser) {
    console.log(`Auth user already exists: ${email}`);
    return existingUser.id;
  }

  // Create user in Supabase auth - the trigger will create the User record
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      full_name: name,
    },
  });

  if (error) {
    throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  }

  console.log(`Created auth user: ${email} (${data.user.id})`);
  return data.user.id;
}

// Helper to wait for trigger to create User record
async function waitForUser(
  userId: string,
  maxRetries: number = 10
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`User ${userId} not found after ${maxRetries} retries`);
}

async function main() {
  const seedUserEmail = process.env.SEED_USER_EMAIL;
  if (!seedUserEmail) {
    throw new Error("SEED_USER_EMAIL environment variable is required");
  }

  console.log(`Seeding database with main user email: ${seedUserEmail}`);

  // Create main user in Supabase auth (trigger creates User record)
  const mainUserId = await createAuthUser(seedUserEmail, "Main User");
  await waitForUser(mainUserId);
  const mainUser = await prisma.user.findUniqueOrThrow({
    where: { id: mainUserId },
  });
  console.log(`Main user ready: ${mainUser.name} (${mainUser.email})`);

  // Create seed users in Supabase auth
  const seedUserData = [
    { email: "alice@example.com", name: "Alice Johnson" },
    { email: "bob@example.com", name: "Bob Smith" },
    { email: "charlie@example.com", name: "Charlie Brown" },
    { email: "diana@example.com", name: "Diana Prince" },
  ];

  const seedUserIds = await Promise.all(
    seedUserData.map((u) => createAuthUser(u.email, u.name))
  );

  // Wait for all User records to be created by trigger
  await Promise.all(seedUserIds.map((id) => waitForUser(id)));

  const seedUsers = await Promise.all(
    seedUserIds.map((id) => prisma.user.findUniqueOrThrow({ where: { id } }))
  );
  const [alice, bob, charlie, diana] = seedUsers;
  console.log(`Created ${seedUsers.length} seed users`);

  // Create groups
  const groups = await Promise.all([
    prisma.group.create({
      data: { name: "Roommates" },
    }),
    prisma.group.create({
      data: { name: "Trip to Vegas" },
    }),
    prisma.group.create({
      data: { name: "Office Lunch Club" },
    }),
  ]);
  const [roommatesGroup, vegasGroup, officeGroup] = groups;
  console.log(`Created ${groups.length} groups`);

  // Add members to groups
  await Promise.all([
    // Roommates group: mainUser, alice, bob
    prisma.groupMember.create({
      data: { userId: mainUser.id, groupId: roommatesGroup.id },
    }),
    prisma.groupMember.create({
      data: { userId: alice.id, groupId: roommatesGroup.id },
    }),
    prisma.groupMember.create({
      data: { userId: bob.id, groupId: roommatesGroup.id },
    }),
    // Vegas trip group: mainUser, charlie, diana
    prisma.groupMember.create({
      data: { userId: mainUser.id, groupId: vegasGroup.id },
    }),
    prisma.groupMember.create({
      data: { userId: charlie.id, groupId: vegasGroup.id },
    }),
    prisma.groupMember.create({
      data: { userId: diana.id, groupId: vegasGroup.id },
    }),
    // Office group: mainUser, alice, charlie
    prisma.groupMember.create({
      data: { userId: mainUser.id, groupId: officeGroup.id },
    }),
    prisma.groupMember.create({
      data: { userId: alice.id, groupId: officeGroup.id },
    }),
    prisma.groupMember.create({
      data: { userId: charlie.id, groupId: officeGroup.id },
    }),
  ]);
  console.log("Added members to groups");

  // Create debts - mainUser as LENDER
  const debtsAsLender = await Promise.all([
    prisma.debt.create({
      data: {
        amount: 50.0,
        description: "Groceries split",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: alice.id,
        groupId: roommatesGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 120.0,
        description: "Uber to airport",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: charlie.id,
        groupId: vegasGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 25.0,
        description: "Coffee run",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: alice.id,
        groupId: officeGroup.id,
      },
    }),
  ]);
  console.log(`Created ${debtsAsLender.length} debts where main user is lender`);

  // Create debts - mainUser as BORROWER
  const debtsAsBorrower = await Promise.all([
    prisma.debt.create({
      data: {
        amount: 75.0,
        description: "Electricity bill share",
        status: "pending",
        lenderId: bob.id,
        borrowerId: mainUser.id,
        groupId: roommatesGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 200.0,
        description: "Hotel booking",
        status: "pending",
        lenderId: diana.id,
        borrowerId: mainUser.id,
        groupId: vegasGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 15.0,
        description: "Lunch yesterday",
        status: "pending",
        lenderId: charlie.id,
        borrowerId: mainUser.id,
        groupId: officeGroup.id,
      },
    }),
  ]);
  console.log(
    `Created ${debtsAsBorrower.length} debts where main user is borrower`
  );

  // Create some debts between other users (not involving mainUser)
  const otherDebts = await Promise.all([
    prisma.debt.create({
      data: {
        amount: 30.0,
        description: "Pizza night",
        status: "pending",
        lenderId: alice.id,
        borrowerId: bob.id,
        groupId: roommatesGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 85.0,
        description: "Show tickets",
        status: "pending",
        lenderId: charlie.id,
        borrowerId: diana.id,
        groupId: vegasGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 42.5,
        description: "Cleaning supplies",
        status: "pending",
        lenderId: bob.id,
        borrowerId: alice.id,
        groupId: roommatesGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 150.0,
        description: "Casino night buy-in",
        status: "pending",
        lenderId: diana.id,
        borrowerId: charlie.id,
        groupId: vegasGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 18.0,
        description: "Office snacks",
        status: "pending",
        lenderId: alice.id,
        borrowerId: charlie.id,
        groupId: officeGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 65.0,
        description: "Pool party drinks",
        status: "settled",
        lenderId: charlie.id,
        borrowerId: diana.id,
        groupId: vegasGroup.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 22.0,
        description: "Takeout order",
        status: "settled",
        lenderId: bob.id,
        borrowerId: alice.id,
        groupId: roommatesGroup.id,
      },
    }),
  ]);
  console.log(`Created ${otherDebts.length} debts between other users`);

  // Create tabs for mainUser
  const tabs = await Promise.all([
    prisma.tab.create({
      data: {
        amount: 45.0,
        description: "Borrowed for lunch",
        personName: "John (non-user friend)",
        status: "borrowing",
        userId: mainUser.id,
      },
    }),
    prisma.tab.create({
      data: {
        amount: 100.0,
        description: "Concert tickets",
        personName: "Sarah (coworker)",
        status: "lending",
        userId: mainUser.id,
      },
    }),
    prisma.tab.create({
      data: {
        amount: 20.0,
        description: "Gas money",
        personName: "Mike (neighbor)",
        status: "paid",
        userId: mainUser.id,
      },
    }),
  ]);
  console.log(`Created ${tabs.length} tabs for main user`);

  // Create debt transactions
  const debtTransactions = await Promise.all([
    // A drop request from alice on debt where mainUser is lender
    prisma.debtTransaction.create({
      data: {
        debtId: debtsAsLender[0].id,
        type: "drop",
        status: "pending",
        requesterId: alice.id,
        lenderApproved: false,
        borrowerApproved: true,
        reason: "I think we already settled this in cash",
      },
    }),
    // A modify request from mainUser on debt where they are borrower
    prisma.debtTransaction.create({
      data: {
        debtId: debtsAsBorrower[0].id,
        type: "modify",
        status: "pending",
        requesterId: mainUser.id,
        lenderApproved: false,
        borrowerApproved: true,
        proposedAmount: 65.0,
        proposedDescription: "Electricity bill share (adjusted)",
        reason: "The bill was actually less than expected",
      },
    }),
    // An approved transaction
    prisma.debtTransaction.create({
      data: {
        debtId: otherDebts[0].id,
        type: "modify",
        status: "approved",
        requesterId: bob.id,
        lenderApproved: true,
        borrowerApproved: true,
        proposedAmount: 25.0,
        reason: "Partial payment made",
        resolvedAt: new Date(),
      },
    }),
  ]);
  console.log(`Created ${debtTransactions.length} debt transactions`);

  // Create recurring payments - mainUser as lender
  const recurringAsLender = await prisma.recurringPayment.create({
    data: {
      amount: 150.0,
      description: "Monthly internet bill",
      status: "active",
      lenderId: mainUser.id,
      frequency: 30, // monthly
      borrowers: {
        create: [
          { userId: alice.id, splitPercentage: 50 },
          { userId: bob.id, splitPercentage: 50 },
        ],
      },
    },
  });
  console.log("Created recurring payment where main user is lender");

  // Create recurring payment where mainUser is a borrower
  const recurringAsBorrower = await prisma.recurringPayment.create({
    data: {
      amount: 60.0,
      description: "Weekly grocery run",
      status: "active",
      lenderId: alice.id,
      frequency: 7, // weekly
      borrowers: {
        create: [
          { userId: mainUser.id, splitPercentage: 33.33 },
          { userId: bob.id, splitPercentage: 33.33 },
        ],
      },
    },
  });
  console.log("Created recurring payment where main user is borrower");

  // Another recurring payment
  const recurringOther = await prisma.recurringPayment.create({
    data: {
      amount: 100.0,
      description: "Bi-weekly cleaning service",
      status: "active",
      lenderId: charlie.id,
      frequency: 14, // bi-weekly
      borrowers: {
        create: [{ userId: diana.id, splitPercentage: 100 }],
      },
    },
  });
  console.log("Created additional recurring payment");

  // Inactive recurring payment
  await prisma.recurringPayment.create({
    data: {
      amount: 200.0,
      description: "Old gym membership split (cancelled)",
      status: "inactive",
      lenderId: mainUser.id,
      frequency: 30,
      borrowers: {
        create: [{ userId: charlie.id, splitPercentage: 50 }],
      },
    },
  });
  console.log("Created inactive recurring payment");

  console.log("\nSeed completed successfully!");
  console.log("\nSummary:");
  console.log(`- Main user: ${mainUser.email}`);
  console.log(`- Seed users: ${seedUsers.length}`);
  console.log(`- Groups: ${groups.length}`);
  console.log(
    `- Debts: ${debtsAsLender.length + debtsAsBorrower.length + otherDebts.length}`
  );
  console.log(`- Tabs: ${tabs.length}`);
  console.log(`- Debt transactions: ${debtTransactions.length}`);
  console.log(`- Recurring payments: 4`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
