export type Commitment = { id: string; identifier: string; amount: number; hard: boolean; verified?: boolean };

export type Raise = {
  id: string;
  companyName: string;
  thesis: string;
  investmentThesis: string;
  stage: string;
  sourceLink?: string;
  roundRange: { min: number; max: number };
  isFundThesis?: boolean;
  claimed: boolean;
  claimantName?: string | null;
  softTotal?: number;
  hardTotal?: number;
  claim?: {
    founderName: string;
    email: string;
    signatureOrAccount?: string;
    vehicleLink?: string;
  };
  commitments?: Commitment[];
};

// Fictional raise details; claim and commitment state is mirrored to the shared API.
export const INITIAL_RAISES: Raise[] = [
  {
    id: 'confidential-fundraise-thesis',
    companyName: 'Privacy Token Fund',
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
    thesis: 'Each disputed fact becomes an ongoing market; AI writes a public page from the market’s current view.',
    investmentThesis: `Most encyclopedias still rely on people arguing in talk pages or a small group of editors deciding what a page says. Disputed facts can remain unresolved.

Each fact becomes a small, ongoing market: people put money behind the version they believe is correct. AI writes a public page from the market’s current view, and the page updates as the market moves.

NEAR can let participants take positions without showing their whole book and let capital come from other chains. Agents can read the latest page instead of relying on the last editor.`,
    stage: 'Seed',
    roundRange: { min: 1_000_000, max: 2_000_000 },
    claimed: false,
  },
  {
    id: 'harbor-materials',
    companyName: 'Private Social Trading',
    thesis: 'Traders keep NEAR Intents positions private by default and share temporary viewing keys with selected followers; everyone else sees public PnL.',
    investmentThesis: `Copy trading today either reveals full positions or hides enough that followers cannot verify performance.

With NEAR Intents, the trader keeps positions private by default and sells a temporary viewing key to specific people who want to follow or copy. Everyone else sees public PnL; the trader chooses who gets a key.

An agent can receive a key and act on trades without the trader opening the whole book.`,
    stage: 'Pre-seed',
    roundRange: { min: 500_000, max: 1_000_000 },
    claimed: false,
  },
  {
    id: 'lumen-labs',
    companyName: 'Universal Checkout Widget',
    thesis: 'A single checkout button lets users pay with an existing wallet and chain through NEAR Intents.',
    investmentThesis: `Accepting crypto payments often sends users to one chain or wallet, and some leave rather than switch.

A merchant adds a single checkout button. The user pays with an existing wallet and chain; NEAR Intents routes the payment to the merchant. Agents can call the same button, removing the chain-selection step for both sides.`,
    stage: 'Series A',
    roundRange: { min: 3_000_000, max: 5_000_000 },
    claimed: false,
  },
  {
    id: 'swarm-for-hire',
    companyName: 'Swarm-for-Hire',
    thesis: 'Job posters set a NEAR budget; others fund agent inference, and accepted work is paid from the budget.',
    investmentThesis: `Today, agents are either run by one company or prompted individually; there is no open way to post a job and let others fund agents to join.

A job poster sets a budget in NEAR. Others can fund an agent’s inference, and agents take work; accepted work is paid from the budget. Simple guardrails or review are proposed to reduce spam.

NEAR handles payment and inference costs, making agents directly fundable and payable participants.`,
    stage: 'Pre-seed',
    roundRange: { min: 500_000, max: 1_000_000 },
    claimed: false,
  },
];
