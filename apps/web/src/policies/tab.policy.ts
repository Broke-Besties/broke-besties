import { Tab } from "@prisma/client";

export class TabPolicy {
  /**
   * Check if user owns this tab
   */
  static isOwner(userId: string, tab: Pick<Tab, "userId">): boolean {
    return tab.userId === userId;
  }

  /**
   * Check if user can view a tab (must be owner)
   */
  static canView(userId: string, tab: Pick<Tab, "userId">): boolean {
    return TabPolicy.isOwner(userId, tab);
  }

  /**
   * Check if user can update a tab (must be owner)
   */
  static canUpdate(userId: string, tab: Pick<Tab, "userId">): boolean {
    return TabPolicy.isOwner(userId, tab);
  }

  /**
   * Check if user can delete a tab (must be owner)
   */
  static canDelete(userId: string, tab: Pick<Tab, "userId">): boolean {
    return TabPolicy.isOwner(userId, tab);
  }

  /**
   * Check if status is valid for a tab
   */
  static isValidStatus(status: string): boolean {
    return ["lending", "borrowing", "paid"].includes(status);
  }
}
