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

interface PaypalPaymentRefundedEmailProps {
  recipientName?: string;
  borrowerName?: string;
  lenderName?: string;
  amount?: number;
  description?: string | null;
  debtLink?: string;
  /** The refund put the debt back to pending. */
  debtReopened?: boolean;
}

export const PaypalPaymentRefundedEmail = ({
  recipientName = "there",
  borrowerName = "Someone",
  lenderName = "Someone",
  amount = 0,
  description = null,
  debtLink = "#",
  debtReopened = false,
}: PaypalPaymentRefundedEmailProps) => {
  const amountText = `$${amount.toFixed(2)}`;
  const forText = description ? ` for ${description}` : "";

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{`A PayPal payment of ${amountText} was refunded`}</Preview>
        <Container style={container}>
          <Heading style={h1}>PayPal Payment Refunded</Heading>

          <Text style={text}>Hi {recipientName},</Text>

          <Text style={text}>
            {`The PayPal payment of ${amountText} from ${borrowerName} to ${lenderName}${forText} was refunded or reversed in PayPal.`}
          </Text>

          <Text style={text}>
            {debtReopened
              ? "The debt is pending again, so it still needs to be paid."
              : "The debt's status didn't change."}
          </Text>

          <Section style={detailsContainer}>
            <Text style={statusBadge}>↩ Refunded</Text>
            <Text style={amountStyle}>{amountText}</Text>
            {description && <Text style={descriptionStyle}>{description}</Text>}
          </Section>

          <Section style={buttonContainer}>
            <Link style={button} href={debtLink}>
              View Debt
            </Link>
          </Section>

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
  backgroundColor: "#fff8e1",
  borderRadius: "8px",
  border: "2px solid #ffb300",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const statusBadge = {
  color: "#e65100",
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

const footerCopyright = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  marginTop: "32px",
};

export default PaypalPaymentRefundedEmail;
