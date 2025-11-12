import { Box, Button, Heading, Image, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import weedyImage from "../images/weedy.webp";

type ParticipantResponse = {
  token: string;
  name: string;
  assignmentsReady: boolean;
  assignedName: string | null;
  participantCount: number;
  shuffledAt: string | null;
};

export function ParticipantPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ParticipantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAssignment = useCallback(async () => {
    if (!token) {
      setError("Missing participant link.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/participant/${token}`);

      if (response.status === 404) {
        setError("No participant found for this link.");
        setData(null);
        return;
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to load assignment.");
      }

      const payload: ParticipantResponse = await response.json();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  const formattedDate = useMemo(() => {
    if (!data?.shuffledAt) return null;
    try {
      return new Date(data.shuffledAt).toLocaleString();
    } catch (error) {
      return null;
    }
  }, [data?.shuffledAt]);

  return (
    <Box
      as="main"
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px="16px"
      overflow="hidden"
    >
      <Box
        width="100%"
        maxW="480px"
        p="32px"
        borderRadius="12px"
        bg="#1e1e1e"
        borderWidth="1px"
        borderColor="#2a2a2a"
        boxShadow="0 12px 40px rgba(0, 0, 0, 0.45)"
        position="relative"
        overflow="visible"
      >

        <Image
          position="absolute"
          top="50%"
          left="50%"
          minHeight="115vh"
          maxHeight="115vh"
          maxWidth="none"
          height="auto"
          pointerEvents="none"
          transform="translate(-50%, -50%)"
          zIndex={-10}
          src={weedyImage}
        />
        <Heading size="6xl" textAlign="center" fontFamily={'"Bender", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'}>
          Your Secret Santa
        </Heading>

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

        {data && (
          <Box mt="24px" textAlign="center">
            <Text fontSize="3xl" fontWeight="medium">
              Hello {data.name}!
            </Text>

            {data.assignmentsReady ? (
              <Box mt="16px">
                {data.assignedName ? (
                  <Text fontSize="xl" fontWeight="semibold">
                    You are buying a gift for <Text as="span" fontWeight="bold" color="#a7f3d0">{data.assignedName}</Text>.
                  </Text>
                ) : (
                  <Text>No assignment is available for this link.</Text>
                )}
              </Box>
            ) : (
              <Box mt="16px">
                <Text>
                  Pairings are not ready yet. Check back after the admin shuffles the
                  participants.
                </Text>
              </Box>
            )}

            <Text mt="12px" fontSize="sm" color="#d7d7d7">
              Participants registered: {data.participantCount}
            </Text>
          </Box>
        )}

        <Button
          mt="32px"
          width="100%"
          size="lg"
          onClick={fetchAssignment}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </Box>
    </Box>
  );
}
