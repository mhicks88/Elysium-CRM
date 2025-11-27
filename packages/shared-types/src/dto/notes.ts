export interface NoteDTO {
  id: string;
  organizationId: string;
  leadId: string;
  authorUserId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  deletedAt?: string | null;
}

export interface CreateNoteDTO {
  organizationId: string;
  leadId: string;
  authorUserId: string;
  body: string;
  isInternal: boolean;
}
