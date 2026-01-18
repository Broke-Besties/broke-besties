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

interface DebtRequestCancelledEmailProps {
  recipientName?: string;
  requesterName?: string;
  type?: "drop" | "modify";
  amount?: number;
  description?: string;
  proposedAmount?: number;
  proposedDescription?: string;
  groupName?: string;
  debtLink?: string;
}

export const DebtRequestCancelledEmail = ({
  recipientName = "there",
  requesterName = "Someone",
  type = "drop",
  amount = 0,
  description = "No description",
  proposedAmount,
  proposedDescription,
  groupName,
  debtLink = "#",
}: DebtRequestCancelledEmailProps) => {
  const isModify = type === "modify";
  const actionText = isModify ? "modification" : "deletion";
  const previewText = `${requesterName} cancelled their debt ${actionText} request`;

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{previewText}</Preview>
        <Container style={container}>
          <Heading style={h1}>Request Cancelled</Heading>

          <Text style={text}>Hi {recipientName},</Text>

          <Text style={text}>
            <strong>{requesterName}</strong> has cancelled their debt{" "}
            {actionText} request{groupName ? ` in ${groupName}` : ""}.
          </Text>

          <Section style={cancelledContainer}>
            <Text style={cancelledTitle}>Request Withdrawn</Text>
            <Text style={cancelledMessage}>
              The {actionText} request has been cancelled. No changes have been
              made to the debt.
            </Text>
          </Section>

          <Section style={debtDetailsContainer}>
            <Text style={sectionTitle}>Current Debt (Unchanged)</Text>
            <Text style={debtAmount}>${amount.toFixed(2)}</Text>
            <Text style={debtDescription}>{description}</Text>
          </Section>

          {isModify && (proposedAmount !== undefined || proposedDescription !== undefined) && (
            <Section style={proposedDetailsContainer}>
              <Text style={sectionTitle}>
                Their Proposed Changes (Cancelled)
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
          )}

          <Text style={text}>
            The debt remains as is. If {requesterName} still wants to make
            changes, they can submit a new request.
          </Text>

          <Section style={buttonContainer}>
            <Link style={button} href={debtLink}>
              View Debt
            </Link>
          </Section>

          <Text style={footer}>
            You no longer need to approve or reject this request. The debt
            remains unchanged.
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

const cancelledContainer = {
  backgroundColor: "#fff9c4",
  borderRadius: "8px",
  border: "2px solid #fbc02d",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const cancelledTitle = {
  color: "#f57f17",
  fontSize: "18px",
  fontWeight: "bold",
  margin: "0 0 12px 0",
};

const cancelledMessage = {
  color: "#666",
  fontSize: "16px",
  margin: "0",
};

const debtDetailsContainer = {
  backgroundColor: "#f5f5f5",
  borderRadius: "8px",
  border: "2px solid #9e9e9e",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const proposedDetailsContainer = {
  backgroundColor: "#f3f3f3",
  borderRadius: "8px",
  border: "2px dashed #bdbdbd",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const sectionTitle = {
  color: "#666",
  fontSize: "14px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 12px 0",
};

const debtAmount = {
  color: "#333",
  fontSize: "36px",
  fontWeight: "bold",
  margin: "0 0 8px 0",
};

const debtDescription = {
  color: "#666",
  fontSize: "16px",
  margin: "0",
};

const changeText = {
  color: "#666",
  fontSize: "16px",
  margin: "8px 0",
  fontWeight: "500" as const,
  textDecoration: "line-through" as const,
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

export default DebtRequestCancelledEmail;
