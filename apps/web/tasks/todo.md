# Redesign Plan: Friend Dashboard + Group Dashboard

## Design Direction

**Aesthetic**: Refined minimal - clean, precise, functional. Think Linear/Stripe dashboard energy.
- No decorative icons, no gradients, no glow effects
- Tight typography hierarchy with clear visual weight
- Generous whitespace, deliberate spacing
- Color only where it communicates meaning (green = positive balance, red = negative)
- Borders and dividers used sparingly for structure

**Color palette**: Uses existing theme - primary green (#66d9a0), red for negative, muted grays for secondary info. No new colors needed.

**Font**: Keeping Inter (already in project). Using weight contrast (400/500/600/700) and size contrast for hierarchy.

---

## Part 1: Friend Dashboard (DONE)

Already redesigned in previous session:
- [x] `friend-header.tsx` - Clean flex row, avatar + name + balance + 2 actions
- [x] `debt-ledger.tsx` - Tabbed interface (Active/Pending/Settled)
- [x] `sidebar-cards.tsx` - Plain sections, no Card wrappers
- [x] `add-debt-dialog.tsx` - Simplified form, no decorative icons
- [x] `friend-dashboard.tsx` - Updated layout grid

---

## Part 2: Group List Page (`/groups`)

### Current Problems
- Basic card grid with minimal info per card
- No visual hierarchy between groups
- No at-a-glance balance info per group

### Proposed Changes

**`groups-client.tsx`**
- [ ] Cleaner header: "Groups" title left, "Create group" button right (remove Dashboard/Invites buttons from header, move elsewhere)
- [ ] Replace card grid with a **table/list layout** on desktop, cards on mobile
- [ ] Each group row shows: group name, member count, your net balance in that group, last activity date
- [ ] Better empty state - simple text + CTA button, no decorative card
- [ ] Create group modal - simplify to just name input + submit (keep it minimal)

---

## Part 3: Group Detail Page (`/groups/[id]`)

### Current Problems
- Doughnut chart is visually heavy and complex with too many filter layers
- Debt list uses cards with inline status selectors (cluttered)
- Members tab is a separate tab requiring navigation away from debts
- Invite modal has 2 tabs (Friends/Email) adding complexity
- Create debt modal supports multi-debt + receipt upload (complex for MVP)
- Too many filter options on the chart (quick view + status + lender/borrower multiselect)

### Proposed Changes

**`group-detail-client.tsx` (main layout)**
- [ ] Header: Back button, group name, member count badge, "Invite" + "Add debt" buttons
- [ ] Remove tabs entirely - show everything on one scrollable page
- [ ] Layout: single column, sections stacked vertically
- [ ] Section order: Header > Balance Summary > Debt Ledger > Members

**Balance Summary (new component: `group-summary.tsx`)**
- [ ] Replace doughnut chart with a simple **balance list**
- [ ] Show each member pair's net balance as a row: "Alice owes Bob $25.00"
- [ ] Your balances highlighted at top
- [ ] Total group spending as a single stat

**Debt Ledger (reuse `DebtRow`/`PendingRow` patterns from `friendsv2/[id]/debt-ledger.tsx`)**
- [ ] Extract shared row components (or copy the pattern) from the friend dashboard's `DebtRow` and `PendingRow`
- [ ] Same tabbed interface: Active / Pending / Settled tabs with counts
- [ ] Same row style: description + date on left, signed colored amount on right, border-b dividers
- [ ] PendingRow: same Approve/Decline buttons pattern for transactions needing approval
- [ ] Only difference: group debts show "Alice > Bob" lender/borrower labels since it's not always you
- [ ] Remove card wrappers, inline status selectors, and multi-select filter dropdowns

**Members Section (inline, not a tab)**
- [ ] Simple list below debts: avatar + name + role for each member
- [ ] Pending invites shown as muted rows with "Pending" badge
- [ ] No separate tab navigation needed

**Invite Modal (simplify)**
- [ ] Single input: search friends or enter email
- [ ] Remove the 2-tab pattern
- [ ] Simple list of results + invite button

**Create Debt Modal (simplify)**
- [ ] Single debt at a time (remove multi-debt support for now)
- [ ] Fields: Who owes, Amount, Description
- [ ] Optional split toggle (like friend dashboard)
- [ ] Remove receipt upload for now

---

## Implementation Order

1. [ ] Finalize this plan with user feedback
2. [ ] Group detail page (`/groups/[id]`) - biggest impact
3. [ ] Group list page (`/groups`) - smaller scope
4. [ ] Type-check everything with `tsc --noEmit`
5. [ ] Visual review and polish

---

## Open Questions for You

1. **Doughnut chart**: Remove entirely and replace with balance list? Or keep a simpler version?
2. **Receipt upload**: Cut it for now or keep?
3. **Multi-debt creation**: Cut for now (single debt at a time) or keep?
4. **Group list**: Table layout or keep cards but improve them?
5. **Any features you want to add** that aren't in the current UI?
