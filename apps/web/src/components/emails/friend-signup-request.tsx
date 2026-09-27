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

interface FriendSignupRequestEmailProps {
  requesterName?: string;
  signupLink?: string;
}

export const FriendSignupRequestEmail = ({
  requesterName = "Someone",
  signupLink = "#",
}: FriendSignupRequestEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>
        {requesterName} added you on BrokeBesties — sign up to join them
      </Preview>
      <Container style={container}>
        <Heading style={h1}>You've been added on BrokeBesties!</Heading>

        <Text style={text}>
          <strong>{requesterName}</strong> added you as a friend and wants to
          split expenses with you.
        </Text>

        <Text style={text}>
          Create an account to accept your friend request and keep track of any
          debts they've recorded with you.
        </Text>

        <Section style={buttonContainer}>
          <Link style={button} href={signupLink}>
            Sign up for BrokeBesties
          </Link>
        </Section>

        <Text style={footer}>
          If you didn't expect this, you can safely ignore this email.
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

export default FriendSignupRequestEmail;
