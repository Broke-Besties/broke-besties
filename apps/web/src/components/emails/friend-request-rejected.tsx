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

interface FriendRequestRejectedEmailProps {
  recipientName?: string;
  rejectorName?: string;
}

export const FriendRequestRejectedEmail = ({
  recipientName = "there",
  rejectorName = "Someone",
}: FriendRequestRejectedEmailProps) => (
  <Html>
    <Head />
    <Body style={main}>
      <Preview>{rejectorName} declined your friend request on BrokeBesties</Preview>
      <Container style={container}>
        <Heading style={h1}>Friend Request Declined</Heading>

        <Text style={text}>
          Hi <strong>{recipientName}</strong>,
        </Text>

        <Text style={text}>
          <strong>{rejectorName}</strong> has declined your friend request on BrokeBesties.
        </Text>

        <Text style={text}>
          You can continue using BrokeBesties to manage your expenses with your other friends.
        </Text>

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

export default FriendRequestRejectedEmail;
