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

async function resetDatabase() {
  console.log("Clearing existing data...");
  // Delete in dependency order
  await prisma.debtTransaction.deleteMany();
  await prisma.recurringPaymentBorrower.deleteMany();
  await prisma.recurringPayment.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.debt.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.tab.deleteMany();
  await prisma.groupInvite.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.friend.deleteMany();
  await prisma.user.deleteMany();
  console.log("Database cleared.");
}

async function main() {
  const shouldReset = process.argv.includes("--reset");
  if (shouldReset) {
    await resetDatabase();
  }

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
    { email: "elena@example.com", name: "Elena Vasquez" },
    { email: "frank@example.com", name: "Frank Okafor" },
  ];

  const seedUserIds = await Promise.all(
    seedUserData.map((u) => createAuthUser(u.email, u.name))
  );

  // Wait for all User records to be created by trigger
  await Promise.all(seedUserIds.map((id) => waitForUser(id)));

  const seedUsers = await Promise.all(
    seedUserIds.map((id) => prisma.user.findUniqueOrThrow({ where: { id } }))
  );
  const [alice, bob, charlie, diana, elena, frank] = seedUsers;
  console.log(`Created ${seedUsers.length} seed users`);

  // ── Friendships ──────────────────────────────────────────────
  // mainUser friends with everyone, plus cross-friendships
  const friendPairs: [string, string][] = [
    [mainUser.id, alice.id],
    [mainUser.id, bob.id],
    [mainUser.id, charlie.id],
    [mainUser.id, diana.id],
    [mainUser.id, elena.id],
    [mainUser.id, frank.id],
    [alice.id, bob.id],
    [alice.id, charlie.id],
    [charlie.id, diana.id],
    [elena.id, frank.id],
    [bob.id, elena.id],
  ];

  await Promise.all(
    friendPairs.map(([requesterId, recipientId], i) =>
      prisma.friend.create({
        data: {
          requesterId,
          recipientId,
          status: "accepted",
          createdAt: new Date(
            now.getTime() - (180 - i * 10) * 24 * 60 * 60 * 1000
          ),
        },
      })
    )
  );
  // One pending friend request (diana → frank)
  await prisma.friend.create({
    data: {
      requesterId: diana.id,
      recipientId: frank.id,
      status: "pending",
    },
  });
  console.log(`Created ${friendPairs.length} accepted friendships + 1 pending`);

  // Create groups
  const groups = await Promise.all([
    prisma.group.create({ data: { name: "Roommates" } }),
    prisma.group.create({ data: { name: "Trip to Vegas" } }),
    prisma.group.create({ data: { name: "Office Lunch Club" } }),
    prisma.group.create({ data: { name: "Weekend Hikers" } }),
    prisma.group.create({ data: { name: "Book Club" } }),
  ]);
  const [roommatesGroup, vegasGroup, officeGroup, hikersGroup, bookClub] =
    groups;
  console.log(`Created ${groups.length} groups`);

  // Add members to groups
  const memberAssignments: [string, number][] = [
    // Roommates: mainUser, alice, bob
    [mainUser.id, roommatesGroup.id],
    [alice.id, roommatesGroup.id],
    [bob.id, roommatesGroup.id],
    // Vegas: mainUser, charlie, diana, elena
    [mainUser.id, vegasGroup.id],
    [charlie.id, vegasGroup.id],
    [diana.id, vegasGroup.id],
    [elena.id, vegasGroup.id],
    // Office: mainUser, alice, charlie, frank
    [mainUser.id, officeGroup.id],
    [alice.id, officeGroup.id],
    [charlie.id, officeGroup.id],
    [frank.id, officeGroup.id],
    // Hikers: mainUser, bob, elena, frank
    [mainUser.id, hikersGroup.id],
    [bob.id, hikersGroup.id],
    [elena.id, hikersGroup.id],
    [frank.id, hikersGroup.id],
    // Book Club: mainUser, alice, diana
    [mainUser.id, bookClub.id],
    [alice.id, bookClub.id],
    [diana.id, bookClub.id],
  ];
  await Promise.all(
    memberAssignments.map(([userId, groupId]) =>
      prisma.groupMember.create({ data: { userId, groupId } })
    )
  );
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

  // ── Extra debts involving elena & frank ────────────────────
  const extraDebts = await Promise.all([
    // mainUser lent elena for hiking gear
    prisma.debt.create({
      data: {
        amount: 55.0,
        description: "Hiking boots rental",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: elena.id,
        groupId: hikersGroup.id,
      },
    }),
    // frank owes mainUser for book
    prisma.debt.create({
      data: {
        amount: 18.5,
        description: "Shared Kindle book",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: frank.id,
        groupId: officeGroup.id,
      },
    }),
    // mainUser owes elena for gas
    prisma.debt.create({
      data: {
        amount: 32.0,
        description: "Gas for trail drive",
        status: "pending",
        lenderId: elena.id,
        borrowerId: mainUser.id,
        groupId: hikersGroup.id,
      },
    }),
    // Settled debt mainUser → elena
    prisma.debt.create({
      data: {
        amount: 70.0,
        description: "Camping supplies",
        status: "paid",
        lenderId: mainUser.id,
        borrowerId: elena.id,
        groupId: hikersGroup.id,
      },
    }),
    // Settled debt frank → mainUser
    prisma.debt.create({
      data: {
        amount: 28.0,
        description: "Team lunch",
        status: "paid",
        lenderId: frank.id,
        borrowerId: mainUser.id,
        groupId: officeGroup.id,
      },
    }),
    // elena ↔ frank standalone debts
    prisma.debt.create({
      data: {
        amount: 110.0,
        description: "Concert presale tickets",
        status: "pending",
        lenderId: elena.id,
        borrowerId: frank.id,
      },
    }),
    prisma.debt.create({
      data: {
        amount: 45.0,
        description: "Uber pool rides (last 3 weeks)",
        status: "pending",
        lenderId: frank.id,
        borrowerId: elena.id,
      },
    }),
    // alice owes mainUser for book club dinner
    prisma.debt.create({
      data: {
        amount: 38.0,
        description: "Book club dinner host supplies",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: alice.id,
        groupId: bookClub.id,
      },
    }),
    // diana owes mainUser from book club
    prisma.debt.create({
      data: {
        amount: 22.0,
        description: "Shared audiobook subscription",
        status: "pending",
        lenderId: mainUser.id,
        borrowerId: diana.id,
        groupId: bookClub.id,
      },
    }),
  ]);
  console.log(`Created ${extraDebts.length} extra debts (elena, frank, more cross-friend)`);

  // ── Extra pending transactions ──────────────────────────────
  await Promise.all([
    // confirm_paid from elena on hiking boots debt
    prisma.debtTransaction.create({
      data: {
        debtId: extraDebts[0].id,
        type: "confirm_paid",
        status: "pending",
        requesterId: elena.id,
        lenderApproved: false,
        borrowerApproved: true,
        reason: "Sent via Venmo yesterday",
      },
    }),
    // frank wants to modify the Kindle book debt
    prisma.debtTransaction.create({
      data: {
        debtId: extraDebts[1].id,
        type: "modify",
        status: "pending",
        requesterId: frank.id,
        lenderApproved: false,
        borrowerApproved: true,
        proposedAmount: 9.25,
        proposedDescription: "Shared Kindle book (50/50 split)",
        reason: "Should be split evenly, not full price",
      },
    }),
  ]);
  console.log("Created extra pending transactions (confirm_paid + modify)");

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

  // Recurring: mainUser pays Spotify, elena splits
  await prisma.recurringPayment.create({
    data: {
      amount: 16.99,
      description: "Spotify Family Plan",
      status: "active",
      lenderId: mainUser.id,
      frequency: 30,
      borrowers: {
        create: [
          { userId: elena.id, splitPercentage: 50 },
        ],
      },
    },
  });

  // Recurring: frank pays gym, mainUser splits
  await prisma.recurringPayment.create({
    data: {
      amount: 80.0,
      description: "Gym membership duo",
      status: "active",
      lenderId: frank.id,
      frequency: 30,
      borrowers: {
        create: [{ userId: mainUser.id, splitPercentage: 50 }],
      },
    },
  });

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
  console.log("Created recurring payments (6 total)");

  const totalDebts =
    debtsAsLender.length + debtsAsBorrower.length + otherDebts.length + extraDebts.length;

  console.log("\n✅ Seed completed successfully!");
  console.log("\nSummary:");
  console.log(`- Main user: ${mainUser.email}`);
  console.log(`- Seed users: ${seedUsers.length} (alice, bob, charlie, diana, elena, frank)`);
  console.log(`- Friendships: ${friendPairs.length} accepted + 1 pending`);
  console.log(`- Groups: ${groups.length} (Roommates, Vegas, Office, Hikers, Book Club)`);
  console.log(`- Debts: ${totalDebts} (4 paid, rest pending/settled)`);
  console.log(`- Alerts: 8 (7 active, 1 inactive)`);
  console.log(`- Tabs: ${tabs.length}`);
  console.log(`- Debt transactions: ${debtTransactions.length + 2} (pending + approved)`);
  console.log(`- Recurring payments: 6 (5 active, 1 inactive)`);
  console.log("\nFriend dashboard URLs (append friend user ID):");
  console.log(`- Alice:   /friendsv2/${alice.id}`);
  console.log(`- Bob:     /friendsv2/${bob.id}`);
  console.log(`- Charlie: /friendsv2/${charlie.id}`);
  console.log(`- Diana:   /friendsv2/${diana.id}`);
  console.log(`- Elena:   /friendsv2/${elena.id}`);
  console.log(`- Frank:   /friendsv2/${frank.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
