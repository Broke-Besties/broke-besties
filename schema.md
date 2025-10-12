







# 
1. Friend groups being able to monitor each other's debts 
2. Friends can track each other's savings towards a group goal (ie going on a trip) progress bar
3. Declare debts on other people in the friend group 
4. Storing images of receipts 
5. Debt transfer
6. Notifications every x days set by user (ie deadlines, send other users notifications)
7. Nice/funny stats/dashboard of group debts 



Optional: Interest



Auth:
Clerk
Google
Apple

Db:
Sqllite/prisma

Schema:

CORE:

EVERYTHING SHOULD HAVE TIMESTAMPS
CREATEDAT
UPDATEDAT

User {
    id
    name
    Friendgroup[] (user: has many friendgroups)
#    Goals[] (user: has many goals)
}


Friendgroup {
    id
    name
    Users[] (friend group: has many users)
    Debts[]
}

Debt {
    id
    Friendgroup (debts: has one friendgroup)
    borrower: User
    lender: User
    amount
    description (what the borrower is borrowing money for ie food )
}


After:


Goal {
    Leader: User
    Friendgroup
    name
    description
    target
}

GoalPerPerson {
    Goal
    User
    amountSoFar
    target
}



