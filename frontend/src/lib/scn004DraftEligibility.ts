import type { AnswerResponse, DocumentType } from '@/types/api';

import { classifyDocumentDraftSupport } from './documentDraftCatalog';

type DraftDocumentEligibility = Record<DocumentType, boolean>;

export interface Scn004DraftEligibility {
  isEligible: boolean;
  documentTypes: DraftDocumentEligibility;
}

export function getScn004DraftEligibility(
  response: AnswerResponse,
): Scn004DraftEligibility {
  const classification = classifyDocumentDraftSupport(response);

  return {
    isEligible: classification.isEligible,
    documentTypes: classification.documentTypes,
  };
}
