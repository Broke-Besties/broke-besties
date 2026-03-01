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

interface GroupInviteAcceptedEmailProps {
  recipientName?: string;
  accepterName?: string;
  groupName?: string;
  groupLink?: string;
}

export const GroupInviteAcceptedEmail = ({
  recipientName = "there",
  accepterName = "Someone",
  groupName = "your group",
  groupLink = "#",
}: GroupInviteAcceptedEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{accepterName} accepted your invite to {groupName}!</Preview>
      <Container style={container}>
        <Heading style={h1}>Group Invite Accepted!</Heading>

        <Text style={text}>
          Hi <strong>{recipientName}</strong>,
        </Text>

        <Text style={text}>
          Great news! <strong>{accepterName}</strong> has accepted your invitation to join{" "}
          <strong>{groupName}</strong> on BrokeBesties.
        </Text>

        <Text style={text}>
          Your group is growing! You can now start tracking shared expenses and
          settling debts together.
        </Text>

        <Section style={buttonContainer}>
          <Link style={button} href={groupLink}>
            View Group
          </Link>
        </Section>

        <Text style={footer}>
          Keep your finances organized with BrokeBesties.
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

export default GroupInviteAcceptedEmail;
