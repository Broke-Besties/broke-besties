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

interface AlertReminderEmailProps {
  borrowerName?: string;
  lenderName?: string;
  amount?: number;
  description?: string | null;
  message?: string | null;
  deadline?: Date | string | null;
  groupName?: string | null;
  debtLink?: string;
  manageAlertsLink?: string;
}

export const AlertReminderEmail = ({
  borrowerName = "there",
  lenderName = "Someone",
  amount = 0,
  description,
  message,
  deadline,
  groupName,
  debtLink = "#",
  manageAlertsLink = "#",
}: AlertReminderEmailProps) => {
  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>
          {`Reminder: you owe ${lenderName} $${amount.toFixed(2)}`}
        </Preview>
        <Container style={container}>
          <Heading style={h1}>Payment Reminder</Heading>

          <Text style={text}>Hi {borrowerName},</Text>

          <Text style={text}>
            This is a friendly reminder that you owe <strong>{lenderName}</strong>
            {groupName ? (
              <>
                {" "}in <strong>{groupName}</strong>
              </>
            ) : null}
            .
          </Text>

          <Section style={debtDetailsContainer}>
            <Text style={debtAmount}>${amount.toFixed(2)}</Text>
            {description ? (
              <Text style={debtDescription}>{description}</Text>
            ) : null}
          </Section>

          {message ? (
            <Section style={messageContainer}>
              <Text style={messageLabel}>Note from {lenderName}:</Text>
              <Text style={messageText}>{message}</Text>
            </Section>
          ) : null}

          {formattedDeadline ? (
            <Text style={text}>
              <strong>Deadline:</strong> {formattedDeadline}
            </Text>
          ) : null}

          <Section style={buttonContainer}>
            <Link style={button} href={debtLink}>
              View Debt
            </Link>
          </Section>

          <Text style={footer}>
            Don&apos;t want these reminders?{" "}
            <Link href={manageAlertsLink} style={footerLink}>
              Manage your alerts
            </Link>
            .
          </Text>

          <Text style={footerCopyright}>
            © {new Date().getFullYear()} BrokeBesties. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default AlertReminderEmail;

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

const messageContainer = {
  borderLeft: "3px solid #000",
  padding: "0 0 0 16px",
  margin: "16px 40px",
};

const messageLabel = {
  color: "#8898aa",
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 4px 0",
};

const messageText = {
  color: "#333",
  fontSize: "15px",
  lineHeight: "22px",
  margin: 0,
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

const footerLink = {
  color: "#556cd6",
  textDecoration: "underline",
};

const footerCopyright = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  padding: "0 40px",
  marginTop: "16px",
};
