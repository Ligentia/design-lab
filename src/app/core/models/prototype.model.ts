export interface Prototype {
  id: string;
  title: string;
  tags: string[];
  creator: string;
  date: string;
  description: string;
  folder: string;
  thumbnail?: string;
}

export const CREATORS = ['Craig', 'Chuka', 'Adrian'] as const;
export type Creator = typeof CREATORS[number];
