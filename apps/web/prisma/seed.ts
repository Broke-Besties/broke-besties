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
    
    // Ensure User record exists in database (in case trigger didn't fire)
    await prisma.user.upsert({
      where: { id: existingUser.id },
      update: {},
      create: {
        id: existingUser.id,
        email: existingUser.email!,
        name: name,
      },
    });
    console.log(`Ensured User record exists in database for: ${email}`);
    
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

  // Create alerts first (so we can link them to debts)
  const now = new Date();

  // Alert 1: Active - overdue by 3 days
  const alert1 = await prisma.alert.create({
    data: {
      message: "Friendly reminder: my money didn’t sign a lease with you 😌",
      deadline: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      groupId: roommatesGroup.id,
      lenderId: mainUser.id,
      borrowerId: alice.id,
      isActive: true,
    },
  });

  // Alert 2: Active - overdue by 7 days
  const alert2 = await prisma.alert.create({
    data: {
      message: "It’s been a week. My wallet is starting to feel abandoned 🥲",
      deadline: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      groupId: vegasGroup.id,
      lenderId: mainUser.id,
      borrowerId: charlie.id,
      isActive: true,
    },
  });

  // Alert 3: Active - due today
  const alert3 = await prisma.alert.create({
    data: {
      message: "Pay me back today pls. I’m trying to grow as a person (financially) 💸",
      deadline: new Date(now.getTime()),
      groupId: roommatesGroup.id,
      lenderId: bob.id,
      borrowerId: mainUser.id,
      isActive: true,
    },
  });

  // Alert 4: Inactive - deadline in the future
  const alert4 = await prisma.alert.create({
    data: {
      message: "All good for now. But I *will* remember this 😈",
      deadline: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      groupId: officeGroup.id,
      lenderId: charlie.id,
      borrowerId: mainUser.id,
      isActive: false,
    },
  });

  // Alert 5: Active - overdue by 14 days
  const alert5 = await prisma.alert.create({
    data: {
      message: "Two weeks overdue. At this point my money has Stockholm syndrome 🧠",
      deadline: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      groupId: vegasGroup.id,
      lenderId: diana.id,
      borrowerId: charlie.id,
      isActive: true,
    },
  });

  // Alert 6: Active - overdue by 5 days
  const alert6 = await prisma.alert.create({
    data: {
      message: "5 days overdue. I’ve refreshed my bank app 17 times 😤",
      deadline: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      groupId: roommatesGroup.id,
      lenderId: alice.id,
      borrowerId: bob.id,
      isActive: true,
    },
  });

  // Alert 7: Active - overdue by 10 days
  const alert7 = await prisma.alert.create({
    data: {
      message: "10 days overdue. Should I Venmo request or start a podcast about this? 🎙️",
      deadline: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      groupId: officeGroup.id,
      lenderId: alice.id,
      borrowerId: charlie.id,
      isActive: true,
    },
  });

  // Alert 8: Active - overdue by 2 days
  const alert8 = await prisma.alert.create({
    data: {
      message: "Overdue by 2 days. My bank account just cleared its throat loudly 😮‍💨",
      deadline: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      groupId: vegasGroup.id,
      lenderId: charlie.id,
      borrowerId: diana.id,
      isActive: true,
    },
  });

  console.log(`Created 8 alerts (7 active, 1 inactive)`);

  // Create debts - mainUser as LENDER
  const debtsAsLender = await Promise.all([
    // Debt with alert - active deadline
    prisma.debt.create({
      data: {
        amount: 50.0,
        description: "Groceries split",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: alice.id,
        groupId: roommatesGroup.id,
        alertId: alert1.id,
      },
    }),
    // Debt with alert - active deadline
    prisma.debt.create({
      data: {
        amount: 120.0,
        description: "Uber to airport",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: charlie.id,
        groupId: vegasGroup.id,
        alertId: alert2.id,
      },
    }),
    // Regular debt without alert
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
    // PAID debt - settled previously
    prisma.debt.create({
      data: {
        amount: 35.0,
        description: "Movie tickets",
        status: "paid",
        lenderId: mainUser.id,
        borrowerId: bob.id,
        groupId: roommatesGroup.id,
      },
    }),
    // PAID debt - another settled debt
    prisma.debt.create({
      data: {
        amount: 90.0,
        description: "Dinner last month",
        status: "paid",
        lenderId: mainUser.id,
        borrowerId: charlie.id,
        groupId: vegasGroup.id,
      },
    }),
  ]);
  console.log(`Created ${debtsAsLender.length} debts where main user is lender (including 2 paid debts)`);

  // Create debts - mainUser as BORROWER
  const debtsAsBorrower = await Promise.all([
    // Debt with alert - urgent deadline tomorrow
    prisma.debt.create({
      data: {
        amount: 75.0,
        description: "Electricity bill share",
        status: "pending",
        lenderId: bob.id,
        borrowerId: mainUser.id,
        groupId: roommatesGroup.id,
        alertId: alert3.id,
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
    // Debt with expired alert
    prisma.debt.create({
      data: {
        amount: 15.0,
        description: "Lunch yesterday",
        status: "pending",
        lenderId: charlie.id,
        borrowerId: mainUser.id,
        groupId: officeGroup.id,
        alertId: alert4.id,
      },
    }),
  ]);
  console.log(
    `Created ${debtsAsBorrower.length} debts where main user is borrower`
  );

  // Create some debts between other users (not involving mainUser)
  const otherDebts = await Promise.all([
    // Debt with alert - deadline in 5 days
    prisma.debt.create({
      data: {
        amount: 30.0,
        description: "Pizza night",
        status: "pending",
        lenderId: alice.id,
        borrowerId: bob.id,
        groupId: roommatesGroup.id,
        alertId: alert6.id,
      },
    }),
    // Debt with alert - deadline in 2 days
    prisma.debt.create({
      data: {
        amount: 85.0,
        description: "Show tickets",
        status: "pending",
        lenderId: charlie.id,
        borrowerId: diana.id,
        groupId: vegasGroup.id,
        alertId: alert8.id,
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
    // Debt with alert - deadline in 14 days
    prisma.debt.create({
      data: {
        amount: 150.0,
        description: "Casino night buy-in",
        status: "pending",
        lenderId: diana.id,
        borrowerId: charlie.id,
        groupId: vegasGroup.id,
        alertId: alert5.id,
      },
    }),
    // Debt with alert - deadline in 10 days
    prisma.debt.create({
      data: {
        amount: 18.0,
        description: "Office snacks",
        status: "pending",
        lenderId: alice.id,
        borrowerId: charlie.id,
        groupId: officeGroup.id,
        alertId: alert7.id,
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
    `- Debts: ${debtsAsLender.length + debtsAsBorrower.length + otherDebts.length} (2 paid, rest pending/settled)`
  );
  console.log(`- Alerts: 8 (7 active, 1 expired)`);
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
