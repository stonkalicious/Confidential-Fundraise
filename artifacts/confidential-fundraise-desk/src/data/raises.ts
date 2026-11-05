export type Commitment = { id: string; identifier: string; amount: number; hard: boolean; verified?: boolean };

export type Raise = {
  id: string;
  companyName: string;
  thesis: string;
  stage: string;
  roundRange: { min: number; max: number };
  claimed: boolean;
  claim?: { founderName: string; email: string; vehicleLink?: string };
  commitments?: Commitment[];
};

// Fictional demo raises. Changes are saved only in this browser's localStorage.
export const INITIAL_RAISES: Raise[] = [
  {
    id: 'cedar-grid',
    companyName: 'AI Encyclopedia',
    thesis: 'Perpetual truth-seeking markets let facts compete; AI generates official pages from current market understanding.',
    stage: 'Seed',
    roundRange: { min: 1_000_000, max: 2_000_000 },
    claimed: false,
  },
  {
    id: 'harbor-materials',
    companyName: 'Private Social Trading',
    thesis: 'Traders can sell viewing keys to selected people who want to follow or copy confidential NEAR Intents trades, with public PnL to help them evaluate performance.',
    stage: 'Pre-seed',
    roundRange: { min: 500_000, max: 1_000_000 },
    claimed: false,
  },
  {
    id: 'lumen-labs',
    companyName: 'Universal Checkout',
    thesis: 'A checkout widget lets any merchant or app accept Intents payments from the wallet and blockchain a user already has.',
    stage: 'Series A',
    roundRange: { min: 3_000_000, max: 5_000_000 },
    claimed: false,
  },
  {
    id: 'swarm-for-hire',
    companyName: 'Swarm-for-Hire',
    thesis: 'Onchain work bids fund agents with NEAR for inference, with guardrails and governance AI review.',
    stage: 'Pre-seed',
    roundRange: { min: 500_000, max: 1_000_000 },
    claimed: false,
  },
];
