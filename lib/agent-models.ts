/**
 * Orchestration models selectable in the AI assistant.
 * 'auto' runs the IG_AGENT object as defined; any other id runs the same spec inline with that model.
 * All ids were verified as available in this account (2026-11-05).
 */
export const AGENT_MODELS = [
  { id: 'auto', label: 'Auto (IG_AGENT default)' },
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'openai-gpt-5.2', label: 'OpenAI GPT-5.2' },
  { id: 'openai-gpt-5.1', label: 'OpenAI GPT-5.1' },
  { id: 'openai-gpt-4.1', label: 'OpenAI GPT-4.1' },
  { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro' },
  { id: 'grok-4.7', label: 'xAI Grok 4.7' },
  { id: 'glm-5.3', label: 'Zhipu GLM 5.3' },
  { id: 'llama4-maverick', label: 'Llama 4 Maverick' },
  { id: 'mistral-large2', label: 'Mistral Large 2' },
] as const;

export type AgentModelId = (typeof AGENT_MODELS)[number]['id'];

export const isAgentModel = (m: unknown): m is AgentModelId => AGENT_MODELS.some((x) => x.id === m);

/** Role agents in IG_GROUP_DB.STRUCTURED (see sql/05_role_agents.sql). 'general' is IG_AGENT. */
export const ROLE_AGENTS = {
  general: 'IG_AGENT',
  cfo: 'IG_CFO_AGENT',
  cro: 'IG_CRO_AGENT',
  ops: 'IG_OPS_AGENT',
} as const;

export type RoleAgentId = keyof typeof ROLE_AGENTS;

export const isRoleAgent = (a: unknown): a is RoleAgentId => typeof a === 'string' && Object.hasOwn(ROLE_AGENTS, a);
