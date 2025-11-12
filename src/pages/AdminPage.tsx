import { Box, Button, Heading, Input, Text, chakra } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

type ShuffleResponse = {
  success: boolean;
  participantCount: number;
  shuffledAt: string | null;
  message?: string;
};

type ParticipantSummary = {
  token: string;
  name: string;
  registeredAt: string;
  hasAssignment: boolean;
};

type ParticipantsResponse = {
  participants: ParticipantSummary[];
  participantCount: number;
  assignmentsReady: boolean;
  shuffledAt: string | null;
  registrationOpen: boolean;
  message?: string;
};

type StatusResponse = {
  registrationOpen: boolean;
  assignmentsReady: boolean;
  participantCount: number;
  shuffledAt: string | null;
};

const List = chakra("ul");
const ListItem = chakra("li");

export function AdminPage() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastShuffledAt, setLastShuffledAt] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [assignmentsReady, setAssignmentsReady] = useState(false);
  const [hasLoadedParticipants, setHasLoadedParticipants] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [isReopening, setIsReopening] = useState(false);

  const fetchStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setStatusMessage(null);
      setErrorMessage(null);
    }

    try {
      const response = await fetch("/api/status");
      if (!response.ok) {
        throw new Error("Unable to load event status.");
      }

      const data: StatusResponse = await response.json();
      setRegistrationOpen(Boolean(data.registrationOpen));
      setAssignmentsReady(Boolean(data.assignmentsReady));
      setParticipantCount(typeof data.participantCount === "number" ? data.participantCount : null);
      setLastShuffledAt(data.shuffledAt ?? null);

      if (!options?.silent) {
        setStatusMessage("Status refreshed.");
      }
      setErrorMessage(null);
    } catch (err) {
      if (!options?.silent) {
        setStatusMessage(null);
        setErrorMessage(err instanceof Error ? err.message : "Unexpected error");
      }
    }
  }, []);

  useEffect(() => {
    void fetchStatus({ silent: true });
  }, [fetchStatus]);

  const loadParticipants = async (options?: { silent?: boolean }) => {
    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMessage("Enter the admin password.");
      return;
    }

    if (!options?.silent) {
      setStatusMessage(null);
      setErrorMessage(null);
    }

    setIsLoadingParticipants(true);

    try {
      const response = await fetch("/api/participants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: trimmed }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && payload !== null && "message" in payload
            ? String((payload as { message: unknown }).message)
            : "Unable to load participants.";
        throw new Error(message);
      }

      const data = (payload || {
        participants: [],
        participantCount: 0,
        assignmentsReady: false,
        shuffledAt: null,
        registrationOpen: true,
      }) as ParticipantsResponse;

      setParticipants(
        data.participants
          .slice()
          .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt)),
      );
      setParticipantCount(data.participantCount);
      setLastShuffledAt(data.shuffledAt);
      setAssignmentsReady(Boolean(data.assignmentsReady));
      setRegistrationOpen(Boolean(data.registrationOpen));
      setHasLoadedParticipants(true);

      if (!options?.silent) {
        setStatusMessage("Participants loaded.");
      }
      setErrorMessage(null);
    } catch (err) {
      if (!options?.silent) {
        setStatusMessage(null);
        setErrorMessage(err instanceof Error ? err.message : "Unexpected error");
      }
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleShuffle = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMessage("Enter the admin password.");
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/shuffle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: trimmed }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      if (!response.ok || !payload || typeof payload !== "object" || payload === null || !(payload as ShuffleResponse).success) {
        const message =
          payload && typeof payload === "object" && payload !== null && "message" in payload
            ? String((payload as { message: unknown }).message)
            : "Unable to shuffle participants.";
        throw new Error(message);
      }

      const data = payload as ShuffleResponse;

      setParticipantCount(data.participantCount);
      setLastShuffledAt(data.shuffledAt);
      setAssignmentsReady(true);
      setRegistrationOpen(false);
      setStatusMessage("Pairs created. Let everyone know to check their link.");
      setErrorMessage(null);
      await loadParticipants({ silent: true });
      await fetchStatus({ silent: true });
    } catch (err) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReopen = async () => {
    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMessage("Enter the admin password.");
      return;
    }

    setIsReopening(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/registration/reopen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: trimmed }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch (error) {
        payload = null;
      }

      const data = (payload || {}) as Partial<{ success: boolean; message?: unknown }>;

      if (!response.ok || !data.success) {
        const message =
          typeof data.message === "string" && data.message
            ? data.message
            : "Unable to reopen registration.";
        throw new Error(message);
      }

      setRegistrationOpen(true);
      setAssignmentsReady(false);
      setLastShuffledAt(null);
      setStatusMessage("Registration reopened. Pairings cleared.");
      setErrorMessage(null);
      await loadParticipants({ silent: true });
      await fetchStatus({ silent: true });
    } catch (err) {
      setStatusMessage(null);
      setErrorMessage(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsReopening(false);
    }
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
      <Box
        width="100%"
        maxW="480px"
        p="32px"
        borderRadius="12px"
        bg="#1b1b1b"
        borderWidth="1px"
        borderColor="#262626"
        boxShadow="0 12px 40px rgba(0, 0, 0, 0.45)"
      >
        <Heading size="lg" textAlign="center">
          Admin Panel
        </Heading>

        <Text mt="12px" textAlign="center" color="#d4d4d4">
          Shuffle the pairings when everyone has registered.
        </Text>

        <Text mt="6px" textAlign="center" color="#d4d4d4">
          Registration is currently{" "}
          <Text as="span" fontWeight="semibold">
            {registrationOpen ? "open" : "closed"}
          </Text>
          .
        </Text>

        <Input
          mt="24px"
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          disabled={isLoading || isLoadingParticipants || isReopening}
          bg="#1f1f1f"
          borderColor="#333333"
          color="#f8f8f8"
          _placeholder={{ color: "#8e8e8e" }}
        />

        {errorMessage && (
          <Box
            mt="16px"
            p="12px"
            borderRadius="8px"
            borderWidth="1px"
            borderColor="#7f1d1d"
            bg="#3a1212"
            color="#fca5a5"
          >
            {errorMessage}
          </Box>
        )}

        <Button
          mt="32px"
          width="100%"
          size="lg"
          onClick={handleShuffle}
          disabled={isLoading || isLoadingParticipants || isReopening}
        >
          {isLoading ? "Shuffling..." : "Shuffle pairings"}
        </Button>

        {!registrationOpen && (
          <Box
            mt="20px"
            p="24px"
            borderRadius="10px"
            bg="#1f1f1f"
            borderWidth="1px"
            borderColor="#2f2f2f"
          >
            <Text textAlign="center" fontWeight="semibold" color="#f5f5f5">
              Registration is closed. Need to reopen?
            </Text>
            <Button
              mt="16px"
              width="100%"
              size="lg"
              variant="outline"
              onClick={handleReopen}
              disabled={isLoading || isLoadingParticipants || isReopening}
            >
              {isReopening ? "Reopening..." : "Reopen registration"}
            </Button>
            <Text mt="8px" textAlign="center" fontSize="sm" color="#d4d4d4">
              Reopening clears all pairings and allows new registrations again.
            </Text>
          </Box>
        )}

        <Button
          mt="12px"
          width="100%"
          size="lg"
          variant="outline"
          onClick={() => loadParticipants()}
          disabled={isLoadingParticipants || isLoading || isReopening}
        >
          {isLoadingParticipants ? "Loading participants..." : "View participants"}
        </Button>

        {statusMessage && (
          <Box
            mt="16px"
            p="12px"
            borderRadius="8px"
            borderWidth="1px"
            borderColor="#323232"
            bg="#1f1f1f"
            color="#e5e5e5"
          >
            {statusMessage}
          </Box>
        )}

        {participantCount !== null && (
          <Text mt="16px" color="#d4d4d4">
            Participants included: {participantCount}
          </Text>
        )}

        {lastShuffledAt && (
          <Text mt="8px" color="#c2c2c2" fontSize="sm">
            Last shuffled: {new Date(lastShuffledAt).toLocaleString()}
          </Text>
        )}

        {hasLoadedParticipants && participants.length === 0 && (
          <Text mt="24px" textAlign="center" color="#d4d4d4">
            No participants registered yet.
          </Text>
        )}

        {participants.length > 0 && (
          <Box mt="24px">
            <Text fontWeight="medium" color="#f0f0f0">
              Registered participants
            </Text>
            <List mt="12px" m="0" p="0" listStyleType="none" display="flex" flexDirection="column" gap="12px">
              {participants.map(participant => {
                const parsedDate = new Date(participant.registeredAt);
                const registeredLabel = Number.isNaN(parsedDate.getTime())
                  ? participant.registeredAt
                  : parsedDate.toLocaleString();

                return (
                  <ListItem
                    key={participant.token}
                    borderWidth="1px"
                    borderColor="#2f2f2f"
                    borderRadius="8px"
                    p="12px"
                    bg="#1f1f1f"
                  >
                    <Text fontWeight="semibold">{participant.name}</Text>
                    <Text fontSize="sm" color="#d0d0d0">
                      Registered: {registeredLabel}
                    </Text>
                    {assignmentsReady && (
                      <Text fontSize="sm" color="#d0d0d0">
                        Assignment: {participant.hasAssignment ? "Ready" : "Pending"}
                      </Text>
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </Box>
    </Box>
  );
}
