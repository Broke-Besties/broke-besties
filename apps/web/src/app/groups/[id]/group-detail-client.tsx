"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import NumberFlow from "@number-flow/react";
import { Sparkles, TrendingUp, TrendingDown, Scale, Users, Search, SlidersHorizontal } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  createInvite,
  createDebt,
  createDebts,
  getRecentFriends,
  searchFriendsForInvite,
  addFriendToGroup,
  cancelInvite,
} from "./actions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DebtFormItem } from "./debt-form-item";
import { cn } from "@/lib/utils";
import { DebtDetailDialog } from "@/app/debts/debt-detail-dialog";
import { ConfirmPaidModal } from "@/app/debts/confirm-paid-modal";
import { ModifyDebtModal } from "@/app/debts/modify-debt-modal";
import { DeleteDebtModal } from "@/app/debts/delete-debt-modal";
import { MultiSelect } from "@/components/ui/multi-select";

ChartJS.register(ArcElement, Tooltip, Legend);

// Chart color palette
const CHART_COLORS = [
  "hsl(210 70% 55%)",
  "hsl(340 65% 55%)",
  "hsl(45 85% 55%)",
  "hsl(160 50% 45%)",
  "hsl(270 50% 55%)",
  "hsl(25 80% 55%)",
  "hsl(190 60% 45%)",
  "hsl(0 65% 55%)",
];

const CHART_BORDER_COLORS = [
  "hsl(210 70% 45%)",
  "hsl(340 65% 45%)",
  "hsl(45 85% 45%)",
  "hsl(160 50% 35%)",
  "hsl(270 50% 45%)",
  "hsl(25 80% 45%)",
  "hsl(190 60% 35%)",
  "hsl(0 65% 45%)",
];

type Member = {
  id: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Invite = {
  id: number;
  invitedEmail: string;
  invitedBy: string;
  status: string;
  sender: {
    id: string;
    email: string;
  };
};

type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date | string;
  lender: {
    id: string;
    name: string;
    email: string;
  };
  borrower: {
    id: string;
    name: string;
    email: string;
  };
  group: {
    id: number;
    name: string;
  } | null;
};

type Group = {
  id: number;
  name: string;
  createdAt: Date | string;
  members: Member[];
  invites: Invite[];
};

type GroupDetailPageClientProps = {
  initialGroup: Group;
  initialDebts: Debt[];
  currentUser: User | null;
  groupId: number;
};

export default function GroupDetailPageClient({
  initialGroup,
  initialDebts,
  currentUser,
  groupId,
}: GroupDetailPageClientProps) {
  const [group] = useState<Group>(initialGroup);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("debts");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDebtModal, setShowDebtModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // Table filter state
  const [viewFilter, setViewFilter] = useState<"all" | "lending" | "borrowing">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [chartView, setChartView] = useState<"owed" | "owing">("owed");
  const [selectedLenders, setSelectedLenders] = useState<string[]>(() =>
    group.members.map((m) => m.user.id)
  );
  const [selectedBorrowers, setSelectedBorrowers] = useState<string[]>(() =>
    group.members.map((m) => m.user.id)
  );
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);

  // Temporary filter state for dialog
  const [tempViewFilter, setTempViewFilter] = useState(viewFilter);
  const [tempStatusFilter, setTempStatusFilter] = useState(statusFilter);
  const [tempSortBy, setTempSortBy] = useState(sortBy);
  const [tempSortOrder, setTempSortOrder] = useState(sortOrder);
  const [tempSelectedLenders, setTempSelectedLenders] = useState(selectedLenders);
  const [tempSelectedBorrowers, setTempSelectedBorrowers] = useState(selectedBorrowers);

  // Debt detail dialog and modal state
  const [detailDialogDebt, setDetailDialogDebt] = useState<Debt | null>(null);
  const [activeModal, setActiveModal] = useState<"paid" | "modify" | "delete" | null>(null);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // Friend invite state
  const [inviteTab, setInviteTab] = useState<"friends" | "email">("friends");
  const [friendSearch, setFriendSearch] = useState("");
  const [recentFriends, setRecentFriends] = useState<
    Array<{ id: number; userId: string; name: string; email: string }>
  >([]);
  const [searchResults, setSearchResults] = useState<
    Array<{ id: number; userId: string; name: string; email: string }>
  >([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [cancellingInviteId, setCancellingInviteId] = useState<number | null>(
    null
  );
  const [creating, setCreating] = useState(false);
  const [debtForms, setDebtForms] = useState([
    {
      amount: "",
      description: "",
      borrowerId: "",
      borrower: null as { id: string; name: string; email: string } | null,
    },
  ]);
  const [currentDebtIndex, setCurrentDebtIndex] = useState(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const router = useRouter();

  // Sync debts state with initialDebts when it changes (after refresh)
  useEffect(() => {
    setDebts(initialDebts);
  }, [initialDebts]);

  // Load recent friends when invite modal opens
  useEffect(() => {
    if (showInviteModal) {
      setLoadingFriends(true);
      getRecentFriends(groupId)
        .then((result) => {
          if (result.success) {
            setRecentFriends(result.friends);
          }
        })
        .finally(() => setLoadingFriends(false));
    }
  }, [showInviteModal, groupId]);

  // Search friends with debounce
  useEffect(() => {
    if (!friendSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setSearchingFriends(true);
      searchFriendsForInvite(groupId, friendSearch)
        .then((result) => {
          if (result.success) {
            setSearchResults(result.friends);
          }
        })
        .finally(() => setSearchingFriends(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [friendSearch, groupId]);

  const handleAddFriend = async (friendUserId: string) => {
    setInviting(true);
    setError("");

    try {
      const result = await addFriendToGroup(groupId, friendUserId);

      if (!result.success) {
        setError(result.error || "Failed to add friend to group");
        return;
      }

      setShowInviteModal(false);
      setFriendSearch("");
      setInviteTab("friends");
      router.refresh();
    } catch {
      setError("An error occurred while adding friend to group");
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (inviteId: number) => {
    setCancellingInviteId(inviteId);
    setError("");

    try {
      const result = await cancelInvite(groupId, inviteId);

      if (!result.success) {
        setError(result.error || "Failed to cancel invite");
        return;
      }

      router.refresh();
    } catch {
      setError("An error occurred while cancelling the invite");
    } finally {
      setCancellingInviteId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");

    try {
      const result = await createInvite(groupId, inviteEmail);

      if (!result.success) {
        setError(result.error || "Failed to send invite");
        return;
      }

      setShowInviteModal(false);
      setInviteEmail("");
      router.refresh();
    } catch {
      setError("An error occurred while sending the invite");
    } finally {
      setInviting(false);
    }
  };

  const handleReceiptFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Only JPEG, PNG, and WebP are allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB");
      return;
    }

    setReceiptFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError("");
  };

  const handleCreateDebts = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      // Validate all debts have required fields
      for (let i = 0; i < debtForms.length; i++) {
        const debt = debtForms[i];
        if (!debt.borrowerId) {
          setError(`Debt ${i + 1}: Please select a borrower`);
          setCreating(false);
          setCurrentDebtIndex(i);
          return;
        }
        if (!debt.amount || parseFloat(debt.amount) <= 0) {
          setError(`Debt ${i + 1}: Please enter a valid amount`);
          setCreating(false);
          setCurrentDebtIndex(i);
          return;
        }
      }

      // Upload receipt if there is one
      let receiptId: string | undefined;
      if (receiptFile) {
        setUploadingReceipt(true);
        const formData = new FormData();
        formData.append("file", receiptFile);
        formData.append("groupId", groupId.toString());

        const uploadResponse = await fetch("/api/receipts/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Failed to upload receipt");
        }

        const uploadData = await uploadResponse.json();
        receiptId = uploadData.data.id;
        setUploadingReceipt(false);
      }

      // Prepare data for all debts
      const debtsToCreate = debtForms.map((debt) => ({
        amount: parseFloat(debt.amount),
        description: debt.description || undefined,
        borrowerId: debt.borrowerId,
        groupId,
        receiptId,
      }));

      // Use single or batch create based on number of debts
      const result =
        debtsToCreate.length === 1
          ? await createDebt(debtsToCreate[0])
          : await createDebts(debtsToCreate);

      if (!result.success) {
        setError(result.error || "Failed to create debt(s)");
        setCreating(false);
        return;
      }

      // Reset form and refresh
      setShowDebtModal(false);
      setDebtForms([
        {
          amount: "",
          description: "",
          borrowerId: "",
          borrower: null,
        },
      ]);
      setCurrentDebtIndex(0);
      setReceiptFile(null);
      setReceiptPreview(null);
      setCreating(false);

      // Refresh the page to show new debts
      router.refresh();
    } catch {
      setError("An error occurred while creating the debt(s)");
      setCreating(false);
    }
  };

  const addNewDebt = () => {
    setDebtForms([
      ...debtForms,
      {
        amount: "",
        description: "",
        borrowerId: "",
        borrower: null,
      },
    ]);
    setCurrentDebtIndex(debtForms.length);
  };

  const removeDebt = (index: number) => {
    if (debtForms.length === 1) return;
    const newDebts = debtForms.filter((_, i) => i !== index);
    setDebtForms(newDebts);
    if (currentDebtIndex >= newDebts.length) {
      setCurrentDebtIndex(newDebts.length - 1);
    }
  };

  const updateDebtForm = (index: number, data: (typeof debtForms)[0]) => {
    const newDebts = [...debtForms];
    newDebts[index] = data;
    setDebtForms(newDebts);
  };

  const currentDebt = debtForms[currentDebtIndex];

  // Check if all debts are valid
  const allDebtsValid = debtForms.every(
    (debt) => debt.borrowerId && debt.amount && parseFloat(debt.amount) > 0
  );

  // Member options for multi-select
  const memberOptions = useMemo(
    () =>
      group.members.map((m) => ({
        value: m.user.id,
        label:
          m.user.id === currentUser?.id
            ? `${m.user.name || m.user.email} (you)`
            : m.user.name || m.user.email,
      })),
    [group.members, currentUser?.id]
  );

  // Calculate totals for cards
  const lendingDebts = debts.filter((debt) => debt.lender.id === currentUser?.id);
  const borrowingDebts = debts.filter((debt) => debt.borrower.id === currentUser?.id);
  const totalLending = lendingDebts
    .filter((d) => d.status === "pending")
    .reduce((sum, debt) => sum + debt.amount, 0);
  const totalBorrowing = borrowingDebts
    .filter((d) => d.status === "pending")
    .reduce((sum, debt) => sum + debt.amount, 0);
  const netBalance = totalLending - totalBorrowing;

  // Filter and sort debts for table
  const filteredDebts = useMemo(() => {
    let result = debts;

    // Apply view filter
    if (viewFilter === "lending") {
      result = result.filter((d) => d.lender.id === currentUser?.id);
    } else if (viewFilter === "borrowing") {
      result = result.filter((d) => d.borrower.id === currentUser?.id);
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Apply lender/borrower multi-select filters
    result = result.filter(
      (d) =>
        selectedLenders.includes(d.lender.id) &&
        selectedBorrowers.includes(d.borrower.id)
    );

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((debt) => {
        return (
          debt.lender.name?.toLowerCase().includes(query) ||
          debt.lender.email.toLowerCase().includes(query) ||
          debt.borrower.name?.toLowerCase().includes(query) ||
          debt.borrower.email.toLowerCase().includes(query) ||
          debt.description?.toLowerCase().includes(query)
        );
      });
    }

    // Sort by date or amount
    return [...result].sort((a, b) => {
      if (sortBy === "amount") {
        return sortOrder === "desc" ? b.amount - a.amount : a.amount - b.amount;
      }
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });
  }, [debts, viewFilter, statusFilter, searchQuery, sortBy, sortOrder, currentUser?.id, selectedLenders, selectedBorrowers]);

  const openFiltersDialog = () => {
    setTempViewFilter(viewFilter);
    setTempStatusFilter(statusFilter);
    setTempSortBy(sortBy);
    setTempSortOrder(sortOrder);
    setTempSelectedLenders(selectedLenders);
    setTempSelectedBorrowers(selectedBorrowers);
    setShowFiltersDialog(true);
  };

  const applyFilters = () => {
    setViewFilter(tempViewFilter);
    setStatusFilter(tempStatusFilter);
    setSortBy(tempSortBy);
    setSortOrder(tempSortOrder);
    setSelectedLenders(tempSelectedLenders);
    setSelectedBorrowers(tempSelectedBorrowers);
    setShowFiltersDialog(false);
  };

  const resetFilters = () => {
    const allMemberIds = group.members.map((m) => m.user.id);
    setTempViewFilter("all");
    setTempStatusFilter("all");
    setTempSortBy("date");
    setTempSortOrder("desc");
    setTempSelectedLenders(allMemberIds);
    setTempSelectedBorrowers(allMemberIds);
  };

  const handleAction = (action: "paid" | "modify" | "delete", debt: Debt) => {
    setSelectedDebt(debt);
    setActiveModal(action);
  };

  const handleModalClose = () => {
    setActiveModal(null);
    setSelectedDebt(null);
  };

  const handleSuccess = () => {
    router.refresh();
  };

  // Chart data based on selected view
  const { chartData, chartDescriptions } = useMemo(() => {
    const relevantDebts =
      chartView === "owed"
        ? lendingDebts.filter((d) => d.status === "pending")
        : borrowingDebts.filter((d) => d.status === "pending");

    if (relevantDebts.length === 0) {
      return {
        chartData: {
          labels: [chartView === "owed" ? "No one owes you" : "You owe no one"],
          datasets: [
            {
              data: [1],
              backgroundColor: ["rgba(156, 163, 175, 0.3)"],
              borderColor: ["rgba(156, 163, 175, 0.5)"],
              borderWidth: 1,
            },
          ],
        },
        chartDescriptions: [] as string[][],
      };
    }

    // Group by person with descriptions
    const personData = new Map<string, { amount: number; descriptions: string[] }>();
    for (const debt of relevantDebts) {
      const personObj = chartView === "owed" ? debt.borrower : debt.lender;
      const person = personObj.name || personObj.email;
      const existing = personData.get(person) || { amount: 0, descriptions: [] };
      existing.amount += debt.amount;
      if (debt.description) {
        existing.descriptions.push(debt.description);
      }
      personData.set(person, existing);
    }

    const entries = Array.from(personData.entries()).sort(
      (a, b) => b[1].amount - a[1].amount
    );

    return {
      chartData: {
        labels: entries.map(([person]) => person),
        datasets: [
          {
            data: entries.map(([, data]) => data.amount),
            backgroundColor: entries.map(
              (_, i) => CHART_COLORS[i % CHART_COLORS.length]
            ),
            borderColor: entries.map(
              (_, i) => CHART_BORDER_COLORS[i % CHART_BORDER_COLORS.length]
            ),
            borderWidth: 2,
          },
        ],
      },
      chartDescriptions: entries.map(([, data]) => data.descriptions),
    };
  }, [chartView, lendingDebts, borrowingDebts]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "right" as const,
          labels: {
            boxWidth: 12,
            padding: 12,
            font: {
              size: 12,
            },
          },
        },
        tooltip: {
          callbacks: {
            title: (context: any) => context[0]?.label || "",
            label: (context: any) => {
              const value = context.parsed;
              const total = context.dataset.data.reduce(
                (a: number, b: number) => a + b,
                0
              );
              const percentage = ((value / total) * 100).toFixed(1);
              return `$${value.toFixed(2)} (${percentage}%)`;
            },
            afterLabel: (context: any) => {
              const descriptions = chartDescriptions[context.dataIndex];
              if (!descriptions || descriptions.length === 0) return "";
              const truncate = (s: string, len: number) =>
                s.length > len ? s.slice(0, len) + "..." : s;
              const shown = descriptions.slice(0, 2).map((d) => `• ${truncate(d, 25)}`);
              if (descriptions.length > 2) {
                shown.push(`  +${descriptions.length - 2} more`);
              }
              return shown;
            },
          },
        },
      },
      cutout: "60%",
    }),
    [chartDescriptions]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          className="w-fit px-0"
          onClick={() => router.push("/groups")}
        >
          ← Back to groups
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">
              {group.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Created {new Date(group.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowDebtModal(true)}>
              Create debts
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push(`/ai?group=${groupId}`)}
            >
              <Sparkles className="h-4 w-4" />
              Create with AI
            </Button>
            <Button onClick={() => setShowInviteModal(true)}>
              Invite member
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* You are owed (green) */}
        <button
          type="button"
          onClick={() => setChartView("owed")}
          className={cn(
            "relative rounded-xl p-4 text-left transition-all",
            chartView === "owed" ? "green-box-active" : "green-box"
          )}
        >
          <TrendingUp className="absolute top-4 right-4 h-5 w-5 text-green" />
          <p className="text-sm text-green">You are owed</p>
          <p className="text-2xl font-bold text-green">
            <NumberFlow
              value={totalLending}
              format={{ style: "currency", currency: "USD" }}
            />
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {lendingDebts.filter((d) => d.status === "pending").length} pending
          </p>
        </button>

        {/* You owe (red) */}
        <button
          type="button"
          onClick={() => setChartView("owing")}
          className={cn(
            "relative rounded-xl p-4 text-left transition-all",
            chartView === "owing" ? "red-box-active" : "red-box"
          )}
        >
          <TrendingDown className="absolute top-4 right-4 h-5 w-5 text-red" />
          <p className="text-sm text-red">You owe</p>
          <p className="text-2xl font-bold text-red">
            <NumberFlow
              value={totalBorrowing}
              format={{ style: "currency", currency: "USD" }}
            />
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {borrowingDebts.filter((d) => d.status === "pending").length} pending
          </p>
        </button>

        {/* Net balance */}
        <div className="relative rounded-xl p-4 border bg-card/50">
          <Scale className="absolute top-4 right-4 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Net balance</p>
          <p className={cn(
            "text-2xl font-bold",
            netBalance >= 0 ? "text-green" : "text-red"
          )}>
            {netBalance >= 0 ? "+" : "-"}
            <NumberFlow
              value={Math.abs(netBalance)}
              format={{ style: "currency", currency: "USD" }}
            />
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {netBalance >= 0 ? "in your favor" : "you owe more"}
          </p>
        </div>

        {/* Members */}
        <div className="relative rounded-xl p-4 border bg-card/50">
          <Users className="absolute top-4 right-4 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Members</p>
          <p className="text-2xl font-bold">
            <NumberFlow value={group.members.length} />
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {group.invites.length} pending invite{group.invites.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {chartView === "owed" ? "Who owes you" : "Who you owe"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Debts and Members */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="debts">Debts</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="debts" className="space-y-0 mt-4">
          <Card>
            {/* Table Header with Search and Filters Button */}
            <div className="border-b p-4">
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search debts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Filters Button */}
                <Button
                  variant="outline"
                  onClick={openFiltersDialog}
                  className="gap-2"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </div>
            </div>

            {/* Table Content */}
            {filteredDebts.length === 0 ? (
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No debts found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || viewFilter !== "all" ||
                   selectedLenders.length < group.members.length ||
                   selectedBorrowers.length < group.members.length
                    ? "Try adjusting your filters or search"
                    : "Create a debt to get started"}
                </p>
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lender</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDebts.map((debt) => {
                    const isLender = debt.lender.id === currentUser?.id;
                    const isBorrower = debt.borrower.id === currentUser?.id;

                    return (
                      <TableRow
                        key={debt.id}
                        className="cursor-pointer h-16"
                        onClick={() => setDetailDialogDebt(debt)}
                      >
                        <TableCell className="py-4">
                          <span className={cn(
                            "font-medium",
                            isLender && "text-emerald-600 dark:text-emerald-400"
                          )}>
                            {debt.lender.name || debt.lender.email}
                            {isLender && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                          </span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className={cn(
                            "font-medium",
                            isBorrower && "text-rose-600 dark:text-rose-400"
                          )}>
                            {debt.borrower.name || debt.borrower.email}
                            {isBorrower && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                          {debt.description || "-"}
                        </TableCell>
                        <TableCell className="py-4 hidden sm:table-cell text-muted-foreground">
                          {new Date(debt.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-4 text-right font-semibold">
                          ${debt.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="members" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle>Members</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {group.members.length} total
                  </p>
                </div>
                <Badge variant="secondary">{group.members.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-md border bg-background p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {member.user.name}
                        {member.user.id === currentUser?.id && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.user.email}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle>Pending invites</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {group.invites.length} outstanding
                  </p>
                </div>
                <Badge variant="secondary">{group.invites.length}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {group.invites.length === 0 ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                    No pending invites.
                  </div>
                ) : (
                  group.invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between rounded-md border bg-background p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {invite.invitedEmail}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Invited by {invite.sender.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                        >
                          Pending
                        </Badge>
                        {currentUser?.id === invite.invitedBy && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={cancellingInviteId === invite.id}
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            {cancellingInviteId === invite.id
                              ? "Cancelling…"
                              : "Cancel"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {showInviteModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              {/* Tab Switcher */}
              <div className="mb-4 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={inviteTab === "friends" ? "default" : "outline"}
                  onClick={() => setInviteTab("friends")}
                >
                  Friends
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={inviteTab === "email" ? "default" : "outline"}
                  onClick={() => setInviteTab("email")}
                >
                  Email
                </Button>
              </div>

              {/* Friends Tab */}
              {inviteTab === "friends" && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="friendSearch">Search friends</Label>
                    <Input
                      id="friendSearch"
                      type="text"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      placeholder="Search by name or email..."
                    />
                  </div>

                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {loadingFriends ? (
                      <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                        Loading friends...
                      </div>
                    ) : friendSearch.trim() ? (
                      // Show search results
                      searchingFriends ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                          Searching...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                          No friends found matching your search.
                        </div>
                      ) : (
                        searchResults.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center justify-between rounded-md border bg-background p-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {friend.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {friend.email}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              disabled={inviting}
                              onClick={() => handleAddFriend(friend.userId)}
                            >
                              Add
                            </Button>
                          </div>
                        ))
                      )
                    ) : // Show recent friends
                    recentFriends.length === 0 ? (
                      <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                        No friends available to add. Add friends or use the
                        Email tab to invite by email.
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-muted-foreground">
                          Recent friends
                        </div>
                        {recentFriends.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center justify-between rounded-md border bg-background p-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">
                                {friend.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {friend.email}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              disabled={inviting}
                              onClick={() => handleAddFriend(friend.userId)}
                            >
                              Add
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowInviteModal(false);
                        setFriendSearch("");
                        setInviteTab("friends");
                        setError("");
                      }}
                    >
                      Cancel
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* Email Tab */}
              {inviteTab === "email" && (
                <form onSubmit={handleInvite} className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="inviteEmail">Email address</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="member@example.com"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowInviteModal(false);
                        setInviteEmail("");
                        setInviteTab("friends");
                        setError("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviting}>
                      {inviting ? "Sending…" : "Send invite"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </div>
          </DialogContent>
        </div>
      )}

      {showDebtModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Create new debt
                {debtForms.length > 1 &&
                  ` (${currentDebtIndex + 1} of ${debtForms.length})`}
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <form onSubmit={handleCreateDebts} className="grid gap-4">
                <DebtFormItem
                  debtData={currentDebt}
                  groupId={groupId}
                  currentUserId={currentUser?.id}
                  onChange={(data) => updateDebtForm(currentDebtIndex, data)}
                />

                {/* Receipt Upload (shown only for first debt) */}
                {currentDebtIndex === 0 && (
                  <div className="grid gap-2">
                    <Label htmlFor="receipt">Receipt (optional)</Label>
                    <input
                      id="receipt"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleReceiptFileSelect}
                      className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {receiptPreview && (
                      <div className="mt-2 rounded-md border bg-muted/50 p-2">
                        <img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="h-32 w-auto object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}

                {debtForms.length > 1 && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCurrentDebtIndex(Math.max(0, currentDebtIndex - 1))
                      }
                      disabled={currentDebtIndex === 0}
                    >
                      ← Prev
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Debt {currentDebtIndex + 1} of {debtForms.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setCurrentDebtIndex(
                          Math.min(debtForms.length - 1, currentDebtIndex + 1)
                        )
                      }
                      disabled={currentDebtIndex === debtForms.length - 1}
                    >
                      Next →
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addNewDebt}
                    className="flex-1"
                  >
                    + Add another debt
                  </Button>
                  {debtForms.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeDebt(currentDebtIndex)}
                    >
                      Remove this debt
                    </Button>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowDebtModal(false);
                      setDebtForms([
                        {
                          amount: "",
                          description: "",
                          borrowerId: "",
                          borrower: null,
                        },
                      ]);
                      setCurrentDebtIndex(0);
                      setError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating || !allDebtsValid}>
                    {creating
                      ? "Creating…"
                      : `Create ${debtForms.length} debt${
                          debtForms.length > 1 ? "s" : ""
                        }`}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </div>
      )}

      {/* Filters Dialog */}
      {showFiltersDialog && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay onClick={() => setShowFiltersDialog(false)} />
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Filters</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 px-6 py-4">
              {/* View Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">View</Label>
                <div className="flex gap-2">
                  {(["all", "lending", "borrowing"] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => setTempViewFilter(view)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        tempViewFilter === view
                          ? view === "lending"
                            ? "green-badge"
                            : view === "borrowing"
                            ? "red-badge"
                            : "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {view === "all" && "All"}
                      {view === "lending" && "Lending"}
                      {view === "borrowing" && "Borrowing"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex gap-2">
                  {(["all", "pending", "paid"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setTempStatusFilter(status)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        tempStatusFilter === status
                          ? status === "pending"
                            ? "yellow-badge"
                            : status === "paid"
                            ? "green-badge"
                            : "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lenders Multi-Select */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lenders</Label>
                <MultiSelect
                  options={memberOptions}
                  selected={tempSelectedLenders}
                  onChange={setTempSelectedLenders}
                  placeholder="Select lenders..."
                />
              </div>

              {/* Borrowers Multi-Select */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Borrowers</Label>
                <MultiSelect
                  options={memberOptions}
                  selected={tempSelectedBorrowers}
                  onChange={setTempSelectedBorrowers}
                  placeholder="Select borrowers..."
                />
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort by</Label>
                <div className="flex gap-2">
                  {(["date", "amount"] as const).map((sort) => (
                    <button
                      key={sort}
                      onClick={() => setTempSortBy(sort)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        tempSortBy === sort
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {sort === "date" ? "Date" : "Amount"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Order */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Sort order</Label>
                <div className="flex gap-2">
                  {(["desc", "asc"] as const).map((order) => (
                    <button
                      key={order}
                      onClick={() => setTempSortOrder(order)}
                      className={cn(
                        "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        tempSortOrder === order
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {order === "desc" ? (tempSortBy === "date" ? "Newest first" : "Highest first") : (tempSortBy === "date" ? "Oldest first" : "Lowest first")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 pb-6">
              <Button variant="outline" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={applyFilters}>Apply Filters</Button>
            </DialogFooter>
          </DialogContent>
        </div>
      )}

      {/* Debt Detail Dialog */}
      <DebtDetailDialog
        debt={detailDialogDebt}
        isOpen={detailDialogDebt !== null}
        onClose={() => setDetailDialogDebt(null)}
        currentUserId={currentUser?.id || ""}
        onMarkAsPaid={(debt) => handleAction("paid", debt)}
        onModify={(debt) => handleAction("modify", debt)}
        onDelete={(debt) => handleAction("delete", debt)}
      />

      {/* Action Modals */}
      <ConfirmPaidModal
        isOpen={activeModal === "paid"}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={selectedDebt}
        isLender={selectedDebt?.lender.id === currentUser?.id}
      />

      <ModifyDebtModal
        isOpen={activeModal === "modify"}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={selectedDebt}
        isLender={selectedDebt?.lender.id === currentUser?.id}
      />

      <DeleteDebtModal
        isOpen={activeModal === "delete"}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        debt={selectedDebt}
        isLender={selectedDebt?.lender.id === currentUser?.id}
      />
    </div>
  );
}
