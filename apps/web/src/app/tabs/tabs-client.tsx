"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createTab, updateTab, deleteTab } from "@/app/tabs/actions";

type Tab = {
  id: number;
  amount: number;
  description: string;
  personName: string;
  status: string;
  createdAt: Date | string;
};

type TabsPageClientProps = {
  initialTabs: Tab[];
};

export default function TabsPageClient({ initialTabs }: TabsPageClientProps) {
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTab, setNewTab] = useState({
    amount: "",
    description: "",
    personName: "",
  });
  const router = useRouter();

  const handleCreateTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const result = await createTab({
        amount: parseFloat(newTab.amount),
        description: newTab.description,
        personName: newTab.personName,
      });

      if (!result.success) {
        setError(result.error || "Failed to create tab");
        return;
      }

      // Add the new tab to state
      if (result.tab) {
        setTabs((prevTabs) => [result.tab as Tab, ...prevTabs]);
      }

      setShowCreateModal(false);
      setNewTab({ amount: "", description: "", personName: "" });
    } catch (err) {
      setError("An error occurred while creating the tab");
    } finally {
      setCreating(false);
    }
  };

  const handleMarkPaid = async (tabId: number) => {
    // Optimistically update the UI
    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId ? { ...tab, status: "paid" } : tab
      )
    );

    try {
      const result = await updateTab(tabId, { status: "paid" });
      if (!result.success) {
        // Revert on error
        setTabs((prevTabs) =>
          prevTabs.map((tab) =>
            tab.id === tabId ? { ...tab, status: "pending" } : tab
          )
        );
        setError(result.error || "Failed to update tab");
        return;
      }
    } catch (err) {
      // Revert on error
      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === tabId ? { ...tab, status: "pending" } : tab
        )
      );
      setError("An error occurred while updating the tab");
    }
  };

  const handleDelete = async (tabId: number) => {
    // Store tab for potential revert
    const deletedTab = tabs.find((tab) => tab.id === tabId);

    // Optimistically remove from UI
    setTabs((prevTabs) => prevTabs.filter((tab) => tab.id !== tabId));

    try {
      const result = await deleteTab(tabId);
      if (!result.success) {
        // Revert on error
        if (deletedTab) {
          setTabs((prevTabs) => [...prevTabs, deletedTab]);
        }
        setError(result.error || "Failed to delete tab");
        return;
      }
    } catch (err) {
      // Revert on error
      if (deletedTab) {
        setTabs((prevTabs) => [...prevTabs, deletedTab]);
      }
      setError("An error occurred while deleting the tab");
    }
  };

  const pendingTabs = tabs.filter((tab) => tab.status === "pending");
  const paidTabs = tabs.filter((tab) => tab.status === "paid");

  const totalOwed = pendingTabs.reduce((sum, tab) => sum + tab.amount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">My Tabs</h1>
          <p className="text-sm text-muted-foreground">
            Track what you owe to people outside the platform.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            Dashboard
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>Add Tab</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {totalOwed > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalOwed.toFixed(2)}</p>
          </CardContent>
        </Card>
      )}

      {tabs.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No tabs yet</CardTitle>
            <CardDescription>
              You haven&apos;t added any tabs. Create one to track what you owe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateModal(true)}>
              Add your first tab
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingTabs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Pending</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingTabs.map((tab) => (
                  <Card key={tab.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{tab.personName}</CardTitle>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                      <CardDescription className="text-xl font-semibold text-foreground">
                        ${tab.amount.toFixed(2)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {tab.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(tab.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleMarkPaid(tab.id)}
                        >
                          Mark Paid
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(tab.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {paidTabs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-muted-foreground">Paid</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {paidTabs.map((tab) => (
                  <Card key={tab.id} className="opacity-60">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{tab.personName}</CardTitle>
                        <Badge variant="outline">Paid</Badge>
                      </div>
                      <CardDescription className="text-xl font-semibold">
                        ${tab.amount.toFixed(2)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {tab.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Added {new Date(tab.createdAt).toLocaleDateString()}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(tab.id)}
                      >
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add new tab</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <form onSubmit={handleCreateTab} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="personName">Who do you owe?</Label>
                  <Input
                    id="personName"
                    type="text"
                    required
                    value={newTab.personName}
                    onChange={(e) =>
                      setNewTab({ ...newTab, personName: e.target.value })
                    }
                    placeholder="e.g. John, Mom, Coffee Shop"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={newTab.amount}
                    onChange={(e) =>
                      setNewTab({ ...newTab, amount: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">What for?</Label>
                  <Textarea
                    id="description"
                    required
                    value={newTab.description}
                    onChange={(e) =>
                      setNewTab({ ...newTab, description: e.target.value })
                    }
                    placeholder="e.g. Lunch last Tuesday"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewTab({ amount: "", description: "", personName: "" });
                      setError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Adding..." : "Add Tab"}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </div>
      )}
    </div>
  );
}
