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

interface FriendRequestEmailProps {
  requesterName?: string;
  recipientName?: string;
  friendsLink?: string;
}

export const FriendRequestEmail = ({
  requesterName = "Someone",
  recipientName = "there",
  friendsLink = "#",
}: FriendRequestEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{requesterName} sent you a friend request on BrokeBesties</Preview>
      <Container style={container}>
        <Heading style={h1}>You've received a friend request!</Heading>

        <Text style={text}>
          Hi <strong>{recipientName}</strong>,
        </Text>

        <Text style={text}>
          <strong>{requesterName}</strong> sent you a friend request on BrokeBesties.
          Connect with them to easily split expenses and track shared debts.
        </Text>

        <Section style={buttonContainer}>
          <Link style={button} href={friendsLink}>
            View Friend Request
          </Link>
        </Section>

        <Text style={footer}>
          If you didn't expect this request, you can safely ignore this email.
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

export default FriendRequestEmail;
