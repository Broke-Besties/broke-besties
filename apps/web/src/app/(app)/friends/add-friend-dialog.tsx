"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type AddFriendResult =
  | { success: true }
  | { success: false; error: string };

type AddFriendDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (email: string) => Promise<AddFriendResult>;
  onCloseAutoFocus?: React.ComponentProps<
    typeof DialogContent
  >["onCloseAutoFocus"];
};

export function AddFriendDialog({
  open,
  onOpenChange,
  onSubmit,
  onCloseAutoFocus,
}: AddFriendDialogProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const changeOpen = (nextOpen: boolean) => {
    if (inFlight.current) return;
    if (!nextOpen) {
      setEmail("");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || inFlight.current) return;

    inFlight.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(email.trim());
      if (result.success) {
        setEmail("");
        setError(null);
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!submitting}
        onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (inFlight.current) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
          <DialogDescription>Send a friend request by email.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field data-invalid={!!error} data-disabled={submitting}>
              <FieldLabel htmlFor="add-friend-email">Email</FieldLabel>
              <Input
                id="add-friend-email"
                type="email"
                required
                autoComplete="email"
                disabled={submitting}
                aria-invalid={!!error}
                aria-describedby={`add-friend-help${error ? " add-friend-error" : ""}`}
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
              />
              <FieldDescription id="add-friend-help">
                If they haven’t signed up, we’ll invite them. You can record
                debts with them right away.
              </FieldDescription>
              {error && <FieldError id="add-friend-error">{error}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => changeOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !email.trim()}>
              {submitting && <Spinner />}
              {submitting ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
