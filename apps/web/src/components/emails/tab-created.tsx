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

interface TabCreatedEmailProps {
  userName?: string;
  personName?: string;
  amount?: number;
  description?: string;
  status?: "lending" | "borrowing";
  tabsLink?: string;
}

export const TabCreatedEmail = ({
  userName = "there",
  personName = "Someone",
  amount = 0,
  description = "No description",
  status = "borrowing",
  tabsLink = "#",
}: TabCreatedEmailProps) => {
  const isLending = status === "lending";
  const title = isLending ? "Tab Added - You Lent Money" : "Tab Added - You Borrowed Money";
  const previewText = isLending
    ? `You added a tab: ${personName} owes you $${amount.toFixed(2)}`
    : `You added a tab: You owe ${personName} $${amount.toFixed(2)}`;

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>{previewText}</Preview>
        <Container style={container}>
          <Heading style={h1}>Tab Added</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            You've successfully added a new tab to track{" "}
            {isLending ? "money you lent" : "money you borrowed"}.
          </Text>

          <Section style={tabDetailsContainer}>
            <Text style={personLabel}>
              {isLending ? "Who owes you" : "Who you owe"}
            </Text>
            <Text style={personNameStyle}>{personName}</Text>
            <Text style={tabAmount}>${amount.toFixed(2)}</Text>
            <Text style={tabDescription}>{description}</Text>
          </Section>

          <Text style={text}>
            This tab is being tracked in your personal tabs list. You can view
            all your tabs and mark them as paid when settled.
          </Text>

          <Section style={buttonContainer}>
            <Link style={button} href={tabsLink}>
              View All Tabs
            </Link>
          </Section>

          <Text style={footer}>
            This is a confirmation that you added this tab to your BrokeBesties
            account.
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
  backgroundColor: "#f6f9fc",
  borderRadius: "8px",
  padding: "24px 40px",
  margin: "24px 40px",
  textAlign: "center" as const,
};

const personLabel = {
  color: "#666",
  fontSize: "14px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 8px 0",
};

const personNameStyle = {
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

export default TabCreatedEmail;
