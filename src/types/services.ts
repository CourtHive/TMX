/**
 * Shared types for the services layer (mutations, messaging, storage).
 */

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------

/** A single method call in a mutation execution queue. */
export interface MutationMethod {
  method: string;
  params?: Record<string, any>;
}

/** Result returned by factory engine executionQueue or server ack. */
export interface ExecutionResult {
  success?: boolean;
  error?: { message: string; code?: string };
  results?: any[];
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/** Payload broadcast by the server when another client mutates a tournament. */
export interface RemoteMutationPayload {
  methods: MutationMethod[];
  tournamentIds: string[];
  userId?: string;
  timestamp?: number;
}

/** Acknowledgement received from the server after an emitTmx call. */
export interface ServerAck {
  success?: boolean;
  ackId?: string;
  uuid?: string;
  error?: { message: string; code?: string };
}
