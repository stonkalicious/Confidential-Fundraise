export type View = 'progress' | 'how' | 'prospect' | 'sponsor' | 'thesis' | 'rules';

export const MOBILE_RAISE_QUERY = '(max-width: 760px)';

const validViews: View[] = ['progress', 'how', 'prospect', 'sponsor', 'thesis', 'rules'];

export function getInitialRaiseView(search: string, isMobile: boolean): View {
  const requested = new URLSearchParams(search).get('view');
  if (validViews.includes(requested as View)) return requested as View;
  return isMobile ? 'how' : 'progress';
}

export function getRaiseViews(isMobile: boolean): { id: View; index?: string; label: string }[] {
  const opening: { id: View; index?: string; label: string }[] = isMobile
    ? [
        { id: 'how', index: '01', label: 'How this app works' },
        { id: 'progress', index: '02', label: 'Progress' },
      ]
    : [
        { id: 'progress', index: '01', label: 'Progress' },
        { id: 'how', index: '02', label: 'How this app works' },
      ];
  return [
    ...opening,
    { id: 'prospect', label: 'Potential investor' },
    { id: 'sponsor', label: 'Founder' },
    { id: 'thesis', label: 'Thesis' },
    { id: 'rules', label: 'Rules Calculator' },
  ];
}
