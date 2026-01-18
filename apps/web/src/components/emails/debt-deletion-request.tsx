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

interface DebtDeletionRequestEmailProps {
  recipientName?: string;
  requesterName?: string;
  amount?: number;
  description?: string;
  groupName?: string;
  approveLink?: string;
}

export const DebtDeletionRequestEmail = ({
  recipientName = "there",
  requesterName = "Someone",
  amount = 0,
  description = "No description",
  groupName = "your group",
  approveLink = "#",
}: DebtDeletionRequestEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{requesterName} wants to delete a debt in {groupName}</Preview>
      <Container style={container}>
        <Heading style={h1}>Debt Deletion Request</Heading>

        <Text style={text}>
          Hi {recipientName},
        </Text>

        <Text style={text}>
          <strong>{requesterName}</strong> has requested to delete a debt in{" "}
          <strong>{groupName}</strong>.
        </Text>

        <Section style={debtDetailsContainer}>
          <Text style={debtAmount}>${amount.toFixed(2)}</Text>
          <Text style={debtDescription}>{description}</Text>
        </Section>

        <Text style={text}>
          Both parties must agree before a debt can be deleted. Please review and approve if you agree.
        </Text>

        <Section style={buttonContainer}>
          <Link style={approveButton} href={approveLink}>
            Approve Deletion
          </Link>
          <Link style={viewButton} href={approveLink}>
            View Debt
          </Link>
        </Section>

        <Text style={footer}>
          If you don't approve this deletion, no action is needed - the debt will remain active.
        </Text>

        <Text style={footerCopyright}>
          © {new Date().getFullYear()} BrokeBesties. All rights reserved.
        </Text>
      </Container>
    </Body>
  </Html>
);

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

const debtDetailsContainer = {
  backgroundColor: "#fff5e6",
  borderRadius: "8px",
  border: "2px solid #ffca28",
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
  marginBottom: "12px",
};

const viewButton = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  border: "1px solid #ddd",
  color: "#333",
  fontSize: "16px",
  fontWeight: "normal",
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

export default DebtDeletionRequestEmail;
