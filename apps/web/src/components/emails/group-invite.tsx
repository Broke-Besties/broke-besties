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

interface GroupInviteEmailProps {
  inviterName?: string;
  groupName?: string;
  inviteLink?: string;
}

export const GroupInviteEmail = ({
  inviterName = "Someone",
  groupName = "their group",
  inviteLink = "#",
}: GroupInviteEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>You've been invited to join {groupName} on BrokeBesties</Preview>
      <Container style={container}>
        <Heading style={h1}>You've been invited!</Heading>

        <Text style={text}>
          <strong>{inviterName}</strong> has invited you to join{" "}
          <strong>{groupName}</strong> on BrokeBesties.
        </Text>

        <Text style={text}>
          BrokeBesties helps you and your friends track shared expenses and
          settle debts easily.
        </Text>

        <Section style={buttonContainer}>
          <Link style={button} href={inviteLink}>
            Accept Invite
          </Link>
        </Section>

        <Text style={footer}>
          If you didn't expect this invitation, you can safely ignore this
          email.
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

export default GroupInviteEmail;
