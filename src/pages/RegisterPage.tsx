import { Box, Button, Heading, Image, Input, Text, chakra, type ImageProps } from "@chakra-ui/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import amiyaImage from "../images/amiya.webp";
import kaltsitImage from "../images/kaltsit.webp";

const Form = chakra("form");

type StatusPayload = {
  registrationOpen?: boolean;
};

type FormImageProps = ImageProps & {
  side: "left" | "right";
};

function FormImage({ side, ...props }: FormImageProps) {
  return (
    <Image
      position="absolute"
      top="50%"
      maxHeight="70vh"
      maxWidth="none"
      height="auto"
      pointerEvents="none"
      transform={`translate(${side === "left" ? "-60%" : "60%"}, -50%)`}
      left={side === "left" ? "0" : undefined}
      right={side === "right" ? "0" : undefined}
      zIndex={-10}
      {...props}
    />
  );
}

export function RegisterPage() {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const copyResetRef = useRef<number | null>(null);

  const personalLink = token ? `${window.location.origin}/p/${token}` : "";

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/status");
        if (!response.ok) {
          throw new Error("status request failed");
        }

        const data: StatusPayload = await response.json();
        if (active) {
          setRegistrationOpen(data.registrationOpen !== false);
        }
      } catch (error) {
        if (active) {
          setError(prev => prev ?? "Unable to verify registration status right now.");
        }
      } finally {
        if (active) {
          setIsCheckingStatus(false);
        }
      }
    };

    fetchStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current);
      copyResetRef.current = null;
    }
    setCopyStatus("idle");
  }, [token]);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name.");
      return;
    }

    if (!registrationOpen) {
      setError("Registration is closed. Please contact the organizer.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          setRegistrationOpen(false);
        }
        const message = await response.text();
        throw new Error(message || "Unable to register right now.");
      }

      const data: { token: string } = await response.json();
      setToken(data.token);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!personalLink) {
      return;
    }

    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current);
      copyResetRef.current = null;
    }

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
        throw new Error("Clipboard API unavailable");
      }

      await navigator.clipboard.writeText(personalLink);
      setCopyStatus("copied");
    } catch (error) {
      setCopyStatus("error");
      return;
    }

    copyResetRef.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyResetRef.current = null;
    }, 2000);
  };

  return (
    <Box
      as="main"
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="16px"
    >
      <Form
        onSubmit={handleSubmit}
        
        maxWidth="60vw"
        p="32px"
        borderRadius="12px"
        bg="#1e1e1e"
        borderWidth="1px"
        borderColor="#2a2a2a"
        boxShadow="0 12px 40px rgba(0, 0, 0, 0.45)"
        position="relative"
        overflow="visible"
      >
          <FormImage
            src={token ? amiyaImage : kaltsitImage}
            alt="Secret Santa Logo"
            side={token ? "right" : "left"}
          />
        <Heading size="6xl" textAlign="center" fontFamily={'"Bender", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}>
          Secret Santa
        </Heading>

        {!token && (
          <>
            {isCheckingStatus ? (
              <Text mt="8px" textAlign="center" color="#d7d7d7">
                Checking registration status...
              </Text>
            ) : registrationOpen ? (
              <>
                <Text mt="8px" textAlign="center">
                  Enter your name to join. Save the link you receive.
                </Text>

                <Input
                  mt="24px"
                  size="lg"
                  placeholder="Your name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  autoFocus
                  disabled={isSubmitting}
                  bg="#181818"
                  borderColor="#2a2a2a"
                  _placeholder={{ color: "#6b6b6b" }}
                />

                <Button type="submit" mt="16px" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? "Joining..." : "Join Secret Santa"}
                </Button>
              </>
            ) : (
              <Text mt="16px" textAlign="center" color="#d7d7d7">
                Registration is currently closed. Please contact the organizer for updates.
              </Text>
            )}
          </>
        )}

        {error && (
          <Box
            mt="16px"
            p="12px"
            borderRadius="8px"
            borderWidth="1px"
            borderColor="#7a1a1a"
            bg="#3a0f0f"
            color="#f4b4b4"
          >
            {error}
          </Box>
        )}

        {token && (
          <Box mt="24px" textAlign="center">
            <Text fontWeight="medium">Your personal link</Text>
            <Box mt="8px" display="flex" gap="8px" alignItems="stretch">
              <Input
                flex="1"
                value={personalLink}
                readOnly
                size="sm"
                bg="#181818"
                borderColor="#2a2a2a"
                color="#f5f5f5"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                disabled={!personalLink}
                flexShrink={0}
              >
                {copyStatus === "copied" ? "Copied" : "Copy"}
              </Button>
            </Box>
            {copyStatus === "copied" && (
              <Text mt="6px" fontSize="sm" color="#a7f3d0">
                Link copied to clipboard.
              </Text>
            )}
            {copyStatus === "error" && (
              <Text mt="6px" fontSize="sm" color="#f4b4b4">
                Couldn&apos;t copy automatically. Copy it manually instead.
              </Text>
            )}
            <Text mt="8px" fontSize="sm">
              Keep this link safe. You&apos;ll need it after the shuffle.
            </Text>
          </Box>
        )}
      </Form>
    </Box>
  );
}
