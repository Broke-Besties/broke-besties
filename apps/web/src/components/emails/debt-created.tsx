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

interface DebtCreatedEmailProps {
  borrowerName?: string;
  lenderName?: string;
  amount?: number;
  description?: string;
  groupName?: string;
  debtLink?: string;
}

export const DebtCreatedEmail = ({
  borrowerName = "there",
  lenderName = "Someone",
  amount = 0,
  description = "No description provided",
  groupName = "your group",
  debtLink = "#",
}: DebtCreatedEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{lenderName} recorded a debt in {groupName}</Preview>
      <Container style={container}>
        <Heading style={h1}>New Debt Recorded</Heading>

        <Text style={text}>
          Hi {borrowerName},
        </Text>

        <Text style={text}>
          <strong>{lenderName}</strong> has recorded a debt in{" "}
          <strong>{groupName}</strong>.
        </Text>

        <Section style={debtDetailsContainer}>
          <Text style={debtAmount}>${amount.toFixed(2)}</Text>
          <Text style={debtDescription}>{description}</Text>
        </Section>

        <Text style={text}>
          You can view the full details and mark it as paid when you settle up.
        </Text>

        <Section style={buttonContainer}>
          <Link style={button} href={debtLink}>
            View Debt
          </Link>
        </Section>

        <Text style={footer}>
          If you disagree with this debt, you can discuss it with {lenderName} in your group or update the status to "not paying".
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

export default DebtCreatedEmail;
