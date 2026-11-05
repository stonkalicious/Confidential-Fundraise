export type Commitment = { id: string; identifier: string; amount: number; hard: boolean; verified?: boolean };

export type Raise = {
  id: string;
  companyName: string;
  thesis: string;
  investmentThesis: string;
  stage: string;
  roundRange: { min: number; max: number };
  isFundThesis?: boolean;
  claimed: boolean;
  claim?: { founderName: string; email: string; vehicleLink?: string };
  commitments?: Commitment[];
};

// Fictional demo raises. Changes are saved only in this browser's localStorage.
export const INITIAL_RAISES: Raise[] = [
  {
    id: 'confidential-fundraise-thesis',
    companyName: 'Confidential Fundraise Thesis',
    thesis: 'Fund-wide thesis for private money and confidential cross-chain settlement.',
    investmentThesis: '',
    stage: 'Fundraise',
    roundRange: { min: 2_000_000, max: 5_000_000 },
    isFundThesis: true,
    claimed: false,
  },
  {
    id: 'cedar-grid',
    companyName: 'AI Encyclopedia',
    thesis: 'Perpetual truth-seeking markets let facts compete; AI generates official pages from current market understanding.',
    investmentThesis: 'Perpetual prediction markets can continuously challenge individual facts, while AI-generated pages reflect current market understanding. The privacy-fund case depends on whether positions and participation can remain confidential; this concept does not specify that privacy mechanism.',
    stage: 'Seed',
    roundRange: { min: 1_000_000, max: 2_000_000 },
    claimed: false,
  },
  {
    id: 'harbor-materials',
    companyName: 'Private Social Trading',
    thesis: 'Traders can sell viewing keys to selected people who want to follow or copy confidential NEAR Intents trades, with public PnL to help them evaluate performance.',
    investmentThesis: 'Selective viewing keys let traders share positions with chosen followers for copy trading. This directly maps to the fund’s privacy focus, while public PnL gives followers a way to assess performance without broad access to private activity.',
    stage: 'Pre-seed',
    roundRange: { min: 500_000, max: 1_000_000 },
    claimed: false,
  },
  {
    id: 'lumen-labs',
    companyName: 'Universal Checkout Widget',
    thesis: 'A checkout widget lets any merchant or app accept Intents payments from the wallet and blockchain a user already has.',
    investmentThesis: 'A universal checkout can let users pay via Intents from their existing wallet and chain. This idea is about payment access; its fit in a privacy fund depends on confidential settlement, which the current description does not specify.',
    stage: 'Series A',
    roundRange: { min: 3_000_000, max: 5_000_000 },
    claimed: false,
  },
  {
    id: 'swarm-for-hire',
    companyName: 'Swarm-for-Hire',
    thesis: 'Onchain work bids fund agents with NEAR for inference, with guardrails and governance AI review.',
    investmentThesis: 'The idea funds agents with NEAR for inference and lets them accept work across a swarm, with governance or AI review as proposed guardrails. To fit the privacy fund, prompts, data, and outputs would need protection; the current description does not specify it.',
    stage: 'Pre-seed',
    roundRange: { min: 500_000, max: 1_000_000 },
    claimed: false,
  },
];
