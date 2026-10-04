export function paypalConnectError(reason?: string): string {
  switch (reason) {
    case "in_use":
      return "That PayPal account is already linked to another Broke Besties account";
    case "state":
      return "The PayPal connection expired. Try again.";
    case "cancelled":
      return "PayPal connection cancelled";
    default:
      return "Couldn't connect PayPal. Try again.";
  }
}
