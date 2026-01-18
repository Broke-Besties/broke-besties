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

interface TabMarkedPaidEmailProps {
  userName?: string;
  personName?: string;
  amount?: number;
  description?: string;
  wasLending?: boolean;
  tabsLink?: string;
}

export const TabMarkedPaidEmail = ({
  userName = "there",
  personName = "Someone",
  amount = 0,
  description = "No description",
  wasLending = false,
  tabsLink = "#",
}: TabMarkedPaidEmailProps) => {
  const previewText = wasLending
    ? `Tab settled: ${personName} paid you $${amount.toFixed(2)}`
    : `Tab settled: You paid ${personName} $${amount.toFixed(2)}`;

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{previewText}</Preview>
        <Container style={container}>
          <Heading style={h1}>Tab Marked as Paid</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            You've marked a tab as paid. This tab has been moved to your paid
            tabs list.
          </Text>

          <Section style={tabDetailsContainer}>
            <Text style={statusBadge}>✓ Paid</Text>
            <Text style={personLabel}>
              {wasLending ? "Who paid you" : "Who you paid"}
            </Text>
            <Text style={personNameText}>{personName}</Text>
            <Text style={tabAmount}>${amount.toFixed(2)}</Text>
            <Text style={tabDescription}>{description}</Text>
          </Section>

          <Text style={text}>
            {wasLending
              ? `Great! ${personName} has settled their debt with you.`
              : `Great! You've settled this debt with ${personName}.`}
          </Text>

          <Section style={buttonContainer}>
            <Link style={button} href={tabsLink}>
              View All Tabs
            </Link>
          </Section>

          <Text style={footer}>
            You can still view this tab in your paid tabs section. You can also
            delete it if you no longer need to keep track of it.
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

const tabDetailsContainer = {
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

const personLabel = {
  color: "#666",
  fontSize: "14px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 8px 0",
};

const personNameText = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0 0 16px 0",
};

const tabAmount = {
  color: "#333",
  fontSize: "36px",
  fontWeight: "bold",
  margin: "0 0 8px 0",
};

const tabDescription = {
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

export default TabMarkedPaidEmail;
