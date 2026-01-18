import { Resend } from "resend";
import { GroupInviteEmail } from "@/components/emails/group-invite";
import { GroupInviteAcceptedEmail } from "@/components/emails/group-invite-accepted";
import { GroupInviteRejectedEmail } from "@/components/emails/group-invite-rejected";
import { InviteAcceptedEmail } from "@/components/emails/invite-accepted";
import { DebtCreatedEmail } from "@/components/emails/debt-created";
import { DebtDeletionRequestEmail } from "@/components/emails/debt-deletion-request";
import { DebtDeletedEmail } from "@/components/emails/debt-deleted";
import { DebtModificationRequestEmail } from "@/components/emails/debt-modification-request";
import { DebtRequestApprovedEmail } from "@/components/emails/debt-request-approved";
import { DebtRequestRejectedEmail } from "@/components/emails/debt-request-rejected";
import { DebtRequestCancelledEmail } from "@/components/emails/debt-request-cancelled";
import { FriendRequestEmail } from "@/components/emails/friend-request";
import { FriendRequestAcceptedEmail } from "@/components/emails/friend-request-accepted";
import { FriendRequestRejectedEmail } from "@/components/emails/friend-request-rejected";
import { TabCreatedEmail } from "@/components/emails/tab-created";
import { TabMarkedPaidEmail } from "@/components/emails/tab-marked-paid";

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailService {
  private static FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev";

  async sendGroupInvite(params: {
    to: string;
    inviterName: string;
    groupName: string;
    inviteLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `You've been invited to join ${params.groupName} on BrokeBesties`,
        react: GroupInviteEmail({
          inviterName: params.inviterName,
          groupName: params.groupName,
          inviteLink: params.inviteLink,
        }),
      });

      if (error) {
        console.error("Failed to send group invite email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send group invite email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendInviteAccepted(params: {
    to: string;
    accepterName: string;
    groupName: string;
    groupLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `${params.accepterName} accepted your invite to ${params.groupName}`,
        react: InviteAcceptedEmail({
          accepterName: params.accepterName,
          groupName: params.groupName,
          groupLink: params.groupLink,
        }),
      });

      if (error) {
        console.error("Failed to send invite accepted email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send invite accepted email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDebtCreated(params: {
    to: string;
    borrowerName: string;
    lenderName: string;
    amount: number;
    description: string;
    groupName?: string;
    debtLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: params.groupName
          ? `New debt recorded in ${params.groupName}`
          : `${params.lenderName} recorded a debt with you`,
        react: DebtCreatedEmail({
          borrowerName: params.borrowerName,
          lenderName: params.lenderName,
          amount: params.amount,
          description: params.description,
          groupName: params.groupName,
          debtLink: params.debtLink,
        }),
      });

      if (error) {
        console.error("Failed to send debt created email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send debt created email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDebtDeleted(params: {
    to: string;
    recipientName: string;
    lenderName: string;
    borrowerName: string;
    amount: number;
    description: string;
    groupName?: string;
    deletedBy: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: params.groupName
          ? `Debt deleted in ${params.groupName}`
          : `A debt has been deleted`,
        react: DebtDeletedEmail({
          recipientName: params.recipientName,
          lenderName: params.lenderName,
          borrowerName: params.borrowerName,
          amount: params.amount,
          description: params.description,
          groupName: params.groupName,
          deletedBy: params.deletedBy,
        }),
      });

      if (error) {
        console.error("Failed to send debt deleted email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send debt deleted email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDebtDeletionRequest(params: {
    to: string;
    recipientName: string;
    requesterName: string;
    amount: number;
    description: string;
    groupName: string;
    approveLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `Debt deletion request in ${params.groupName}`,
        react: DebtDeletionRequestEmail({
          recipientName: params.recipientName,
          requesterName: params.requesterName,
          amount: params.amount,
          description: params.description,
          groupName: params.groupName,
          approveLink: params.approveLink,
        }),
      });

      if (error) {
        console.error("Failed to send debt deletion request email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send debt deletion request email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDebtModificationRequest(params: {
    to: string;
    recipientName: string;
    requesterName: string;
    type: "drop" | "modify";
    currentAmount: number;
    currentDescription: string;
    proposedAmount?: number;
    proposedDescription?: string;
    reason?: string;
    groupName?: string;
    debtLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const subject =
        params.type === "drop"
          ? params.groupName
            ? `Debt deletion request in ${params.groupName}`
            : "Debt deletion request"
          : params.groupName
          ? `Debt modification request in ${params.groupName}`
          : "Debt modification request";

      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject,
        react: DebtModificationRequestEmail({
          recipientName: params.recipientName,
          requesterName: params.requesterName,
          type: params.type,
          currentAmount: params.currentAmount,
          currentDescription: params.currentDescription,
          proposedAmount: params.proposedAmount,
          proposedDescription: params.proposedDescription,
          reason: params.reason,
          groupName: params.groupName,
          debtLink: params.debtLink,
        }),
      });

      if (error) {
        console.error("Failed to send debt modification request email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send debt modification request email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendFriendRequest(params: {
    to: string;
    recipientName: string;
    requesterName: string;
    friendsLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `${params.requesterName} sent you a friend request on BrokeBesties`,
        react: FriendRequestEmail({
          recipientName: params.recipientName,
          requesterName: params.requesterName,
          friendsLink: params.friendsLink,
        }),
      });

      if (error) {
        console.error("Failed to send friend request email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send friend request email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendFriendRequestAccepted(params: {
    to: string;
    recipientName: string;
    friendName: string;
    friendsLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `You're now friends with ${params.friendName} on BrokeBesties`,
        react: FriendRequestAcceptedEmail({
          recipientName: params.recipientName,
          friendName: params.friendName,
          friendsLink: params.friendsLink,
        }),
      });

      if (error) {
        console.error("Failed to send friend request accepted email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send friend request accepted email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendFriendRequestRejected(params: {
    to: string;
    recipientName: string;
    rejectorName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `${params.rejectorName} declined your friend request on BrokeBesties`,
        react: FriendRequestRejectedEmail({
          recipientName: params.recipientName,
          rejectorName: params.rejectorName,
        }),
      });

      if (error) {
        console.error("Failed to send friend request rejected email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send friend request rejected email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendGroupInviteAccepted(params: {
    to: string;
    recipientName: string;
    accepterName: string;
    groupName: string;
    groupLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `${params.accepterName} accepted your invite to ${params.groupName}`,
        react: GroupInviteAcceptedEmail({
          recipientName: params.recipientName,
          accepterName: params.accepterName,
          groupName: params.groupName,
          groupLink: params.groupLink,
        }),
      });

      if (error) {
        console.error("Failed to send group invite accepted email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send group invite accepted email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendGroupInviteRejected(params: {
    to: string;
    recipientName: string;
    rejectorName: string;
    groupName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `${params.rejectorName} declined your invite to ${params.groupName}`,
        react: GroupInviteRejectedEmail({
          recipientName: params.recipientName,
          rejectorName: params.rejectorName,
          groupName: params.groupName,
        }),
      });

      if (error) {
        console.error("Failed to send group invite rejected email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send group invite rejected email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendTabCreated(params: {
    to: string;
    userName: string;
    personName: string;
    amount: number;
    description: string;
    isLending: boolean;
    tabsLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: params.isLending
          ? `Tab created: ${params.personName} owes you $${params.amount.toFixed(2)}`
          : `Tab created: You owe ${params.personName} $${params.amount.toFixed(2)}`,
        react: TabCreatedEmail({
          userName: params.userName,
          personName: params.personName,
          amount: params.amount,
          description: params.description,
          status: params.isLending ? "lending" : "borrowing",
          tabsLink: params.tabsLink,
        }),
      });

      if (error) {
        console.error("Failed to send tab created email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send tab created email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendTabMarkedPaid(params: {
    to: string;
    userName: string;
    personName: string;
    amount: number;
    description: string;
    wasLending: boolean;
    tabsLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: params.wasLending
          ? `Tab settled: ${params.personName} paid you $${params.amount.toFixed(2)}`
          : `Tab settled: You paid ${params.personName} $${params.amount.toFixed(2)}`,
        react: TabMarkedPaidEmail({
          userName: params.userName,
          personName: params.personName,
          amount: params.amount,
          description: params.description,
          wasLending: params.wasLending,
          tabsLink: params.tabsLink,
        }),
      });

      if (error) {
        console.error("Failed to send tab marked paid email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send tab marked paid email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDebtRequestApproved(params: {
    to: string;
    requesterName: string;
    approverName: string;
    type: "drop" | "modify";
    amount: number;
    description: string;
    proposedAmount?: number;
    proposedDescription?: string;
    groupName?: string;
    debtLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const subject =
        params.type === "drop"
          ? params.groupName
            ? `Your debt deletion request in ${params.groupName} was approved`
            : "Your debt deletion request was approved"
          : params.groupName
          ? `Your debt modification request in ${params.groupName} was approved`
          : "Your debt modification request was approved";

      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject,
        react: DebtRequestApprovedEmail({
          requesterName: params.requesterName,
          approverName: params.approverName,
          type: params.type,
          amount: params.amount,
          description: params.description,
          proposedAmount: params.proposedAmount,
          proposedDescription: params.proposedDescription,
          groupName: params.groupName,
          debtLink: params.debtLink,
        }),
      });

      if (error) {
        console.error("Failed to send debt request approved email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send debt request approved email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDebtRequestRejected(params: {
    to: string;
    requesterName: string;
    rejectorName: string;
    type: "drop" | "modify";
    amount: number;
    description: string;
    proposedAmount?: number;
    proposedDescription?: string;
    groupName?: string;
    debtLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const subject =
        params.type === "drop"
          ? params.groupName
            ? `Your debt deletion request in ${params.groupName} was rejected`
            : "Your debt deletion request was rejected"
          : params.groupName
          ? `Your debt modification request in ${params.groupName} was rejected`
          : "Your debt modification request was rejected";

      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject,
        react: DebtRequestRejectedEmail({
          requesterName: params.requesterName,
          rejectorName: params.rejectorName,
          type: params.type,
          amount: params.amount,
          description: params.description,
          proposedAmount: params.proposedAmount,
          proposedDescription: params.proposedDescription,
          groupName: params.groupName,
          debtLink: params.debtLink,
        }),
      });

      if (error) {
        console.error("Failed to send debt request rejected email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send debt request rejected email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendDebtRequestCancelled(params: {
    to: string;
    recipientName: string;
    requesterName: string;
    type: "drop" | "modify";
    amount: number;
    description: string;
    proposedAmount?: number;
    proposedDescription?: string;
    groupName?: string;
    debtLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const subject =
        params.type === "drop"
          ? params.groupName
            ? `Debt deletion request cancelled in ${params.groupName}`
            : "Debt deletion request cancelled"
          : params.groupName
          ? `Debt modification request cancelled in ${params.groupName}`
          : "Debt modification request cancelled";

      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject,
        react: DebtRequestCancelledEmail({
          recipientName: params.recipientName,
          requesterName: params.requesterName,
          type: params.type,
          amount: params.amount,
          description: params.description,
          proposedAmount: params.proposedAmount,
          proposedDescription: params.proposedDescription,
          groupName: params.groupName,
          debtLink: params.debtLink,
        }),
      });

      if (error) {
        console.error("Failed to send debt request cancelled email:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to send debt request cancelled email:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const emailService = new EmailService();
