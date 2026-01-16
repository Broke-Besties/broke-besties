import { prisma } from "@/lib/prisma";
import { Alert } from "@prisma/client";

export class AlertPolicy {
  /**
   * Check if user can view an alert (must be lender or borrower)
   */
  static canView(
    userId: string,
    alert: Pick<Alert, "lenderId" | "borrowerId">
  ): boolean {
    return alert.lenderId === userId || alert.borrowerId === userId;
  }

  /**
   * Check if user can update an alert (only lender)
   */
  static async canUpdate(
    userId: string,
    alertId: number
  ): Promise<{ canUpdate: boolean; isLender: boolean; alert: Alert | null }> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      return { canUpdate: false, isLender: false, alert: null };
    }

    const isLender = alert.lenderId === userId;
    return { canUpdate: isLender, isLender, alert };
  }

  /**
   * Check if user can delete an alert (only lender)
   */
  static async canDelete(userId: string, alertId: number): Promise<boolean> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      select: { lenderId: true },
    });

    if (!alert) return false;

    return alert.lenderId === userId;
  }
}
