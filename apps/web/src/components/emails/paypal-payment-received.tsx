import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PaypalPaymentReceivedEmailProps {
  recipientName?: string;
  borrowerName?: string;
  lenderName?: string;
  amount?: number;
  description?: string | null;
  debtLink?: string;
  /**
   * The debt was already paid, deleted, or its amount changed when the payment arrived, so it
   * wasn't marked paid (sent to both people).
   */
  alreadySettled?: boolean;
}

export const PaypalPaymentReceivedEmail = ({
  recipientName = "there",
  borrowerName = "Someone",
  lenderName = "Someone",
  amount = 0,
  description = null,
  debtLink = "#",
  alreadySettled = false,
}: PaypalPaymentReceivedEmailProps) => {
  const amountText = `$${amount.toFixed(2)}`;
  const forText = description ? ` for ${description}` : "";
  const previewText = alreadySettled
    ? "A PayPal payment arrived, but the debt wasn't marked paid"
    : `${borrowerName} paid you ${amountText} with PayPal`;

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{previewText}</Preview>
        <Container style={container}>
          <Heading style={h1}>
            {alreadySettled ? "Debt Not Marked Paid" : "Payment Received"}
          </Heading>

          <Text style={text}>Hi {recipientName},</Text>

          {alreadySettled ? (
            <Text style={text}>
              {`${borrowerName}'s PayPal payment of ${amountText} to ${lenderName}${forText} arrived, but the debt was already settled, deleted, or its amount changed after checkout started, so it wasn't marked paid automatically. The lender can refund it in PayPal.`}
            </Text>
          ) : (
            <Text style={text}>
              {`${borrowerName} paid you ${amountText} with PayPal${forText}. The debt is now marked as paid.`}
            </Text>
          )}

          <Section style={detailsContainer}>
            <Text style={statusBadge}>✓ Paid with PayPal</Text>
            <Text style={amountStyle}>{amountText}</Text>
            {description && <Text style={descriptionStyle}>{description}</Text>}
          </Section>

          <Section style={buttonContainer}>
            <Link style={button} href={debtLink}>
              View Debt
            </Link>
          </Section>

          <Text style={footer}>
            The money went straight from one PayPal account to the other.
            Broke Besties never holds it.
          </Text>

          <Text style={footerCopyright}>
            © {new Date().getFullYear()} BrokeBesties. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
};

const h1 = {
  color: "#333",
  fontSize: "32px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0 40px",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  padding: "0 40px",
  marginTop: "16px",
};

const detailsContainer = {
  backgroundColor: "#e8f5e9",
  borderRadius: "8px",
  border: "2px solid #4caf50",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const statusBadge = {
  color: "#2e7d32",
  fontSize: "18px",
  fontWeight: "bold",
  margin: "0 0 16px 0",
};

const amountStyle = {
  color: "#333",
  fontSize: "36px",
  fontWeight: "bold",
  margin: "0 0 8px 0",
};

const descriptionStyle = {
  color: "#666",
  fontSize: "16px",
  margin: "0",
};

const buttonContainer = {
  padding: "27px 40px",
};

const button = {
  backgroundColor: "#000000",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
};

const footer = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "24px",
  padding: "0 40px",
  marginTop: "32px",
};

const footerCopyright = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  marginTop: "16px",
};

export default PaypalPaymentReceivedEmail;
