import { Resend } from "resend";
import { GroupInviteEmail } from "@/components/emails/group-invite";
import { GroupInviteAcceptedEmail } from "@/components/emails/group-invite-accepted";
import { GroupInviteRejectedEmail } from "@/components/emails/group-invite-rejected";
import { InviteAcceptedEmail } from "@/components/emails/invite-accepted";
import { DebtCreatedEmail } from "@/components/emails/debt-created";
import { DebtDeletionRequestEmail } from "@/components/emails/debt-deletion-request";
import { FriendRequestEmail } from "@/components/emails/friend-request";
import { FriendRequestAcceptedEmail } from "@/components/emails/friend-request-accepted";
import { FriendRequestRejectedEmail } from "@/components/emails/friend-request-rejected";

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
    groupName: string;
    debtLink: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await resend.emails.send({
        from: EmailService.FROM_EMAIL,
        to: params.to,
        subject: `New debt recorded in ${params.groupName}`,
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
}

export const emailService = new EmailService();
