export type Commitment = { id: string; identifier: string; amount: number; hard: boolean };

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

// Fictional demo raises. All changes live only in the browser's local array.
export const INITIAL_RAISES: Raise[] = [
  {
    id: 'cedar-grid',
    companyName: 'Cedar Grid',
    thesis: 'Software for coordinating energy use across small commercial buildings.',
    stage: 'Seed',
    roundRange: { min: 1_000_000, max: 2_000_000 },
    claimed: false,
  },
  {
    id: 'harbor-materials',
    companyName: 'Harbor Materials',
    thesis: 'Reusable packaging systems for regional manufacturers.',
    stage: 'Pre-seed',
    roundRange: { min: 500_000, max: 1_000_000 },
    claimed: false,
  },
  {
    id: 'lumen-labs',
    companyName: 'Lumen Labs',
    thesis: 'Tools for organizing laboratory workflows and research records.',
    stage: 'Series A',
    roundRange: { min: 3_000_000, max: 5_000_000 },
    claimed: false,
  },
];
