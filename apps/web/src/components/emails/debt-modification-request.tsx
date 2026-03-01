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

interface DebtModificationRequestEmailProps {
  recipientName?: string;
  requesterName?: string;
  type?: "drop" | "modify";
  currentAmount?: number;
  currentDescription?: string;
  proposedAmount?: number;
  proposedDescription?: string;
  reason?: string;
  groupName?: string;
  debtLink?: string;
}

export const DebtModificationRequestEmail = ({
  recipientName = "there",
  requesterName = "Someone",
  type = "drop",
  currentAmount = 0,
  currentDescription = "No description",
  proposedAmount,
  proposedDescription,
  reason,
  groupName = "your group",
  debtLink = "#",
}: DebtModificationRequestEmailProps) => {
  const isModify = type === "modify";
  const title = isModify ? "Debt Modification Request" : "Debt Deletion Request";
  const actionText = isModify ? "modify" : "delete";
  const previewText = isModify
    ? `${requesterName} wants to modify a debt in ${groupName}`
    : `${requesterName} wants to delete a debt in ${groupName}`;

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{previewText}</Preview>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>

          <Text style={text}>Hi {recipientName},</Text>

          <Text style={text}>
            <strong>{requesterName}</strong> has requested to {actionText} a
            debt{groupName ? ` in ${groupName}` : ""}.
          </Text>

          {isModify ? (
            <>
              <Section style={debtDetailsContainer}>
                <Text style={sectionTitle}>Current Debt</Text>
                <Text style={debtAmount}>${currentAmount.toFixed(2)}</Text>
                <Text style={debtDescription}>{currentDescription}</Text>
              </Section>

              <Section style={proposedDetailsContainer}>
                <Text style={sectionTitle}>Proposed Changes</Text>
                {proposedAmount !== undefined && proposedAmount !== currentAmount && (
                  <Text style={changeText}>
                    Amount: ${currentAmount.toFixed(2)} → $
                    {proposedAmount.toFixed(2)}
                  </Text>
                )}
                {proposedDescription !== undefined &&
                  proposedDescription !== currentDescription && (
                    <Text style={changeText}>
                      Description: {currentDescription || "(none)"} →{" "}
                      {proposedDescription || "(none)"}
                    </Text>
                  )}
              </Section>
            </>
          ) : (
            <Section style={debtDetailsContainer}>
              <Text style={debtAmount}>${currentAmount.toFixed(2)}</Text>
              <Text style={debtDescription}>{currentDescription}</Text>
            </Section>
          )}

          {reason && (
            <Section style={reasonContainer}>
              <Text style={reasonTitle}>Reason:</Text>
              <Text style={reasonText}>{reason}</Text>
            </Section>
          )}

          <Text style={text}>
            Both parties must agree before a debt can be {actionText}d. Please
            review and approve if you agree.
          </Text>

          <Section style={buttonContainer}>
            <Link style={approveButton} href={debtLink}>
              Review & Approve
            </Link>
          </Section>

          <Text style={footer}>
            If you don't approve this {actionText === "modify" ? "modification" : "deletion"},
            you can reject it on the debt details page. The debt will remain unchanged unless both parties approve.
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

const sectionTitle = {
  color: "#666",
  fontSize: "14px",
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 8px 0",
};

const debtDetailsContainer = {
  backgroundColor: "#fff5e6",
  borderRadius: "8px",
  border: "2px solid #ffca28",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const proposedDetailsContainer = {
  backgroundColor: "#e3f2fd",
  borderRadius: "8px",
  border: "2px solid #2196f3",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
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
  color: "#333",
  fontSize: "16px",
  margin: "8px 0",
  fontWeight: "500" as const,
};

const reasonContainer = {
  backgroundColor: "#f5f5f5",
  borderRadius: "8px",
  padding: "16px 24px",
  margin: "24px 40px",
};

const reasonTitle = {
  color: "#666",
  fontSize: "14px",
  fontWeight: "bold",
  margin: "0 0 8px 0",
};

const reasonText = {
  color: "#333",
  fontSize: "16px",
  margin: "0",
  fontStyle: "italic" as const,
};

const buttonContainer = {
  padding: "27px 40px",
};

const approveButton = {
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

export default DebtModificationRequestEmail;
