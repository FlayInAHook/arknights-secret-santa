import { serve } from "bun";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import index from "./index.html";

type Participant = {
  token: string;
  name: string;
  assignmentToken?: string;
  registeredAt: string;
  ipAddress?: string;
};

type PersistedParticipant = {
  token: string;
  name: string;
  assignmentToken: string | null;
  registeredAt: string;
  ipAddress: string | null;
};

type PersistedState = {
  participants: PersistedParticipant[];
  assignmentsReady: boolean;
  lastShuffledAt: string | null;
  registrationOpen: boolean;
};

type AppConfig = {
  adminPassword: string;
};

const CONFIG_FILE = "config.json";
const PARTICIPANTS_FILE = "participants.json";

const participants = new Map<string, Participant>();
let assignmentsReady = false;
let lastShuffledAt: string | null = null;
let registrationOpen = true;
let persistQueue: Promise<void> = Promise.resolve();

const randomToken = () => crypto.randomUUID().replace(/-/g, "");

function normalizeIpCandidate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().replace(/^"|"$/g, "");
  if (!trimmed) {
    return null;
  }

  const firstEntry = trimmed.split(",")[0]!.trim();
  if (!firstEntry) {
    return null;
  }

  if (firstEntry.startsWith("[") && firstEntry.includes("]")) {
    const closingIndex = firstEntry.indexOf("]");
    const inside = firstEntry.slice(1, closingIndex).trim();
    return inside ? inside.slice(0, 128) : null;
  }

  const lastColon = firstEntry.lastIndexOf(":");
  if (lastColon > -1 && firstEntry.indexOf(":") === lastColon) {
    const maybePort = firstEntry.slice(lastColon + 1);
    if (/^\d+$/.test(maybePort)) {
      const withoutPort = firstEntry.slice(0, lastColon).trim();
      return withoutPort ? withoutPort.slice(0, 128) : null;
    }
  }

  return firstEntry.slice(0, 128);
}

function parseForwardedHeader(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const entries = headerValue.split(",");
  for (const entry of entries) {
    const match = entry.match(/for=([^;]+)/i);
    if (match && match[1]) {
      const candidate = normalizeIpCandidate(match[1]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function getRequestIp(req: Request): string | null {
  const headersToCheck = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-client-ip",
    "true-client-ip",
    "fastly-client-ip",
  ];

  for (const header of headersToCheck) {
    const value = req.headers.get(header);
    const candidate = normalizeIpCandidate(value);
    if (candidate) {
      return candidate;
    }
  }

  return parseForwardedHeader(req.headers.get("forwarded"));
}

const createUniqueToken = () => {
  let token = randomToken();
  while (participants.has(token)) {
    token = randomToken();
  }
  return token;
};

function captureState(): PersistedState {
  return {
    assignmentsReady,
    lastShuffledAt,
    registrationOpen,
    participants: Array.from(participants.values()).map(({ token, name, assignmentToken, registeredAt, ipAddress }) => ({
      token,
      name,
      assignmentToken: assignmentToken ?? null,
      registeredAt,
      ipAddress: ipAddress ?? null,
    })),
  };
}

function restoreState(state: PersistedState) {
  participants.clear();
  for (const entry of state.participants) {
    participants.set(entry.token, {
      token: entry.token,
      name: entry.name,
      assignmentToken: entry.assignmentToken ?? undefined,
      registeredAt: entry.registeredAt,
      ipAddress: entry.ipAddress ?? undefined,
    });
  }
  assignmentsReady = Boolean(state.assignmentsReady);
  lastShuffledAt = state.lastShuffledAt ?? null;
  registrationOpen = typeof state.registrationOpen === "boolean" ? state.registrationOpen : true;
}

async function loadPersistedState(): Promise<void> {
  try {
    const contents = await readFile(PARTICIPANTS_FILE, "utf8");
    const parsed = JSON.parse(contents) as Partial<PersistedState>;

    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.participants)) {
      throw new Error("Invalid participants store format.");
    }

    const sanitized: PersistedState = {
      participants: parsed.participants
        .map(participant => {
          if (!participant || typeof participant !== "object") {
            return null;
          }

          const token = "token" in participant ? String((participant as PersistedParticipant).token) : "";
          const name = "name" in participant ? String((participant as PersistedParticipant).name) : "";

          if (!token || !name) {
            return null;
          }

          const registeredAtRaw =
            "registeredAt" in participant ? (participant as PersistedParticipant).registeredAt : null;
          const assignmentTokenRaw =
            "assignmentToken" in participant ? (participant as PersistedParticipant).assignmentToken : null;
          const ipAddressRaw =
            "ipAddress" in participant ? (participant as PersistedParticipant).ipAddress : null;

          const registeredAt =
            typeof registeredAtRaw === "string" && registeredAtRaw ? registeredAtRaw : new Date().toISOString();

          const assignmentToken =
            typeof assignmentTokenRaw === "string" && assignmentTokenRaw ? assignmentTokenRaw : null;

          const ipAddress =
            typeof ipAddressRaw === "string" && ipAddressRaw.trim() ? ipAddressRaw.trim().slice(0, 128) : null;

          return {
            token,
            name,
            registeredAt,
            assignmentToken,
            ipAddress,
          } satisfies PersistedParticipant;
        })
        .filter((item): item is PersistedParticipant => item !== null),
      assignmentsReady: Boolean(parsed.assignmentsReady),
      lastShuffledAt:
        typeof parsed.lastShuffledAt === "string" && parsed.lastShuffledAt ? parsed.lastShuffledAt : null,
      registrationOpen: typeof parsed.registrationOpen === "boolean" ? parsed.registrationOpen : true,
    };

    restoreState(sanitized);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

function persistState(): Promise<void> {
  const snapshot = captureState();
  const payload = JSON.stringify(snapshot, null, 2);
  const tempPath = `${PARTICIPANTS_FILE}.${crypto.randomUUID()}.tmp`;

  const writeOp = async () => {
    try {
      await writeFile(tempPath, payload, "utf8");
      await rename(tempPath, PARTICIPANTS_FILE);
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
  };

  persistQueue = persistQueue.then(writeOp, writeOp);
  return persistQueue;
}

async function loadConfig(): Promise<AppConfig> {
  const file = Bun.file(CONFIG_FILE);
  if (!(await file.exists())) {
    throw new Error(`Missing ${CONFIG_FILE}. Copy config.template.json and set the admin password.`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch (error) {
    throw new Error(
      `Unable to parse ${CONFIG_FILE}: ${error instanceof Error ? error.message : "Invalid JSON"}`,
    );
  }

  if (!raw || typeof raw !== "object" || !("adminPassword" in raw)) {
    throw new Error(`adminPassword is required in ${CONFIG_FILE}.`);
  }

  const adminPassword = (raw as { adminPassword: unknown }).adminPassword;
  if (typeof adminPassword !== "string" || !adminPassword.trim()) {
    throw new Error(`adminPassword must be a non-empty string in ${CONFIG_FILE}.`);
  }

  return { adminPassword: adminPassword.trim() };
}

async function extractPasswordFromRequest(req: Request): Promise<string | null> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && "password" in body) {
      const value = (body as { password: unknown }).password;
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  } catch (error) {
    // Ignore malformed JSON and fall through to unauthorized response.
  }

  return null;
}

const authorizeAdmin = async (req: Request) => {
  const password = await extractPasswordFromRequest(req);
  return password === config.adminPassword;
};

const shuffleAssignments = () => {
  const tokens = Array.from(participants.keys());
  if (tokens.length < 2) {
    throw new Error("At least two participants are required to shuffle.");
  }

  const shuffled = [...tokens];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }

  shuffled.forEach((giverToken, index) => {
    const receiverToken = shuffled[(index + 1) % shuffled.length]!;
    const participant = participants.get(giverToken);
    if (participant) {
      participant.assignmentToken = receiverToken;
    }
  });

  assignmentsReady = true;
  lastShuffledAt = new Date().toISOString();
};

let config: AppConfig;
try {
  config = await loadConfig();
  await loadPersistedState();
} catch (error) {
  const message = error instanceof Error ? error.message : "Failed to initialize application.";
  console.error(message);
  process.exit(1);
}

const server = serve({
  routes: {
    "/*": index,

    "/api/register": {
      async POST(req) {
        if (!registrationOpen) {
          return new Response("Registration is closed. Please contact the organizer.", { status: 403 });
        }

        let body: unknown;
        try {
          body = await req.json();
        } catch (error) {
          return new Response("Invalid JSON", { status: 400 });
        }

        const name =
          typeof body === "object" && body && "name" in body ? String((body as { name: unknown }).name).trim() : "";

        if (!name) {
          return new Response("Name is required", { status: 400 });
        }

        if (name.length > 64) {
          return new Response("Name must be 64 characters or fewer", { status: 400 });
        }

        const previousState = captureState();
        const token = createUniqueToken();
        const registeredAt = new Date().toISOString();
  const ipAddress = getRequestIp(req);
  participants.set(token, { token, name, registeredAt, ipAddress: ipAddress ?? undefined });
        assignmentsReady = false;
        lastShuffledAt = null;
        for (const participant of participants.values()) {
          participant.assignmentToken = undefined;
        }

        try {
          await persistState();
        } catch (error) {
          restoreState(previousState);
          console.error("Failed to persist registration:", error);
          return new Response("Unable to save registration. Try again.", { status: 500 });
        }

        return Response.json(
          {
            token,
            name,
            assignmentsReady,
          },
          { status: 201 },
        );
      },
    },

    "/api/participant/:token": {
      async GET(req) {
        const token = req.params.token;
        const participant = participants.get(token);

        if (!participant) {
          return new Response("Participant not found", { status: 404 });
        }

        const assignment =
          assignmentsReady && participant.assignmentToken
            ? participants.get(participant.assignmentToken)
            : undefined;

        return Response.json({
          token,
          name: participant.name,
          assignmentsReady,
          assignedName: assignment?.name ?? null,
          participantCount: participants.size,
          shuffledAt: lastShuffledAt,
        });
      },
    },

    "/api/participants": {
      async POST(req) {
        if (!(await authorizeAdmin(req))) {
          return Response.json({ message: "Invalid admin password." }, { status: 401 });
        }

        const entries = Array.from(participants.values())
          .map(({ token, name, registeredAt, assignmentToken, ipAddress }) => ({
            token,
            name,
            registeredAt,
            hasAssignment: Boolean(assignmentToken),
            ipAddress: ipAddress ?? null,
          }))
          .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));

        return Response.json({
          participants: entries,
          participantCount: participants.size,
          assignmentsReady,
          shuffledAt: lastShuffledAt,
          registrationOpen,
        });
      },
    },

    "/api/status": {
      async GET() {
        return Response.json({
          registrationOpen,
          assignmentsReady,
          participantCount: participants.size,
          shuffledAt: lastShuffledAt,
        });
      },
    },

    "/api/shuffle": {
      async POST(req) {
        if (!(await authorizeAdmin(req))) {
          return Response.json(
            {
              success: false,
              message: "Invalid admin password.",
            },
            { status: 401 },
          );
        }

        const previousState = captureState();
        try {
          shuffleAssignments();
          registrationOpen = false;
        } catch (error) {
          return Response.json(
            {
              success: false,
              message: error instanceof Error ? error.message : "Unable to shuffle",
            },
            { status: 400 },
          );
        }

        try {
          await persistState();
        } catch (error) {
          restoreState(previousState);
          console.error("Failed to persist shuffle:", error);
          return Response.json(
            {
              success: false,
              message: "Unable to save shuffle results.",
            },
            { status: 500 },
          );
        }

        return Response.json({
          success: true,
          participantCount: participants.size,
          shuffledAt: lastShuffledAt,
        });
      },
    },

    "/api/registration/reopen": {
      async POST(req) {
        if (!(await authorizeAdmin(req))) {
          return Response.json(
            {
              success: false,
              message: "Invalid admin password.",
            },
            { status: 401 },
          );
        }

        const previousState = captureState();
        assignmentsReady = false;
        lastShuffledAt = null;
        registrationOpen = true;
        for (const participant of participants.values()) {
          participant.assignmentToken = undefined;
        }

        try {
          await persistState();
        } catch (error) {
          restoreState(previousState);
          console.error("Failed to persist registration reopen:", error);
          return Response.json(
            {
              success: false,
              message: "Unable to reopen registration.",
            },
            { status: 500 },
          );
        }

        return Response.json({
          success: true,
          participantCount: participants.size,
          registrationOpen,
        });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
