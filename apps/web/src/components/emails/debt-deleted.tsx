import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface DebtDeletedEmailProps {
  recipientName?: string;
  lenderName?: string;
  borrowerName?: string;
  amount?: number;
  description?: string;
  groupName?: string;
  deletedBy?: string;
}

export const DebtDeletedEmail = ({
  recipientName = "there",
  lenderName = "Someone",
  borrowerName = "Someone",
  amount = 0,
  description = "No description provided",
  groupName,
  deletedBy = "The lender",
}: DebtDeletedEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>
        A debt has been deleted
        {groupName && ` in ${groupName}`}
      </Preview>
      <Container style={container}>
        <Heading style={h1}>Debt Deleted</Heading>

        <Text style={text}>
          Hi {recipientName},
        </Text>

        <Text style={text}>
          <strong>{deletedBy}</strong> has deleted a debt
          {groupName && (
            <>
              {" "}in <strong>{groupName}</strong>
            </>
          )}.
        </Text>

        <Section style={debtDetailsContainer}>
          <Text style={debtAmount}>${amount.toFixed(2)}</Text>
          <Text style={debtDescription}>{description}</Text>
          <Text style={debtParties}>
            From <strong>{lenderName}</strong> to <strong>{borrowerName}</strong>
          </Text>
        </Section>

        <Text style={text}>
          This debt has been removed from your records. If this was a mistake,
          {lenderName} can create a new debt.
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
  backgroundColor: "#f6f9fc",
  borderRadius: "8px",
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
  margin: "0 0 8px 0",
};

const debtParties = {
  color: "#666",
  fontSize: "14px",
  margin: "0",
};

const footerCopyright = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  marginTop: "16px",
};

export default DebtDeletedEmail;
