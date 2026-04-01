import { SetMetadata } from '@nestjs/common';

export const SUPPORT_ACCESS_METADATA_KEY = 'supportAccess';

export type SupportAccessMode = 'read' | 'write';

/** GET-style support routes vs mutating POST/PATCH (see SupportKeyService). */
export const SupportAccess = (mode: SupportAccessMode) =>
  SetMetadata(SUPPORT_ACCESS_METADATA_KEY, mode);
