// A "Folder" in the UI. Named Collection in code because Prototype.folder already
// means a GitHub storage path. Membership is many-to-many and denormalised here
// (the collection references prototype .id values); prototypes are never moved/copied.
export interface Collection {
  id: string;              // slug of name
  name: string;
  description?: string;
  creator: string;
  date: string;
  updatedAt?: string;
  prototypeIds: string[];  // prototype .id values that belong to this folder
}
