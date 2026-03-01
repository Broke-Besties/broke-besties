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

interface DebtRequestApprovedEmailProps {
  requesterName?: string;
  approverName?: string;
  type?: "drop" | "modify";
  amount?: number;
  description?: string;
  proposedAmount?: number;
  proposedDescription?: string;
  groupName?: string;
  debtLink?: string;
}

export const DebtRequestApprovedEmail = ({
  requesterName = "there",
  approverName = "Someone",
  type = "drop",
  amount = 0,
  description = "No description",
  proposedAmount,
  proposedDescription,
  groupName,
  debtLink = "#",
}: DebtRequestApprovedEmailProps) => {
  const isModify = type === "modify";
  const actionText = isModify ? "modification" : "deletion";
  const previewText = isModify
    ? `Your debt modification request was approved`
    : `Your debt deletion request was approved`;

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{previewText}</Preview>
        <Container style={container}>
          <Heading style={h1}>Request Approved ✓</Heading>

          <Text style={text}>Hi {requesterName},</Text>

          <Text style={text}>
            Great news! <strong>{approverName}</strong> has approved your debt{" "}
            {actionText} request{groupName ? ` in ${groupName}` : ""}.
          </Text>

          {isModify ? (
            <>
              <Section style={successContainer}>
                <Text style={successTitle}>
                  The debt has been updated with the following changes:
                </Text>
                {proposedAmount !== undefined && proposedAmount !== amount && (
                  <Text style={changeText}>
                    Amount: ${amount.toFixed(2)} → ${proposedAmount.toFixed(2)}
                  </Text>
                )}
                {proposedDescription !== undefined &&
                  proposedDescription !== description && (
                    <Text style={changeText}>
                      Description: {description || "(none)"} →{" "}
                      {proposedDescription || "(none)"}
                    </Text>
                  )}
              </Section>

              <Text style={text}>
                The debt has been successfully modified and both parties have
                agreed to these changes.
              </Text>
            </>
          ) : (
            <>
              <Section style={deletedContainer}>
                <Text style={deletedAmount}>${amount.toFixed(2)}</Text>
                <Text style={deletedDescription}>{description}</Text>
                <Text style={deletedBadge}>✓ Deleted</Text>
              </Section>

              <Text style={text}>
                The debt has been permanently removed from the system. Both
                parties have agreed to this deletion.
              </Text>
            </>
          )}

          <Section style={buttonContainer}>
            <Link style={button} href={debtLink}>
              {isModify ? "View Updated Debt" : "Back to Debts"}
            </Link>
          </Section>

          <Text style={footer}>
            Both parties have approved this {actionText}. The change has been
            applied and is now complete.
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

const successContainer = {
  backgroundColor: "#e8f5e9",
  borderRadius: "8px",
  border: "2px solid #4caf50",
  padding: "24px 40px",
  margin: "24px 40px",
};

const successTitle = {
  color: "#2e7d32",
  fontSize: "16px",
  fontWeight: "bold",
  margin: "0 0 16px 0",
  textAlign: "center" as const,
};

const changeText = {
  color: "#333",
  fontSize: "16px",
  margin: "8px 0",
  fontWeight: "500" as const,
  textAlign: "center" as const,
};

const deletedContainer = {
  backgroundColor: "#ffebee",
  borderRadius: "8px",
  border: "2px dashed #f44336",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const deletedAmount = {
  color: "#666",
  fontSize: "36px",
  fontWeight: "bold",
  margin: "0 0 8px 0",
  textDecoration: "line-through" as const,
};

const deletedDescription = {
  color: "#666",
  fontSize: "16px",
  margin: "0 0 16px 0",
  textDecoration: "line-through" as const,
};

const deletedBadge = {
  color: "#c62828",
  fontSize: "18px",
  fontWeight: "bold",
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

export default DebtRequestApprovedEmail;
