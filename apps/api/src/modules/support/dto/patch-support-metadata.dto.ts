import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class PatchSupportMetadataDto {
  @ApiProperty({
    description:
      'Merged shallow into Tenant.metadata. Pilot keys: demo, commercialEngagement, pilotPhase, csOwner, goLiveDate, goLiveDateActual, venueStatus, pilotHealth, pilotNotes, engineeringLiaison, limitationsAcknowledged, externalIncidentIds, enabledModulesSnapshot, branchCountSnapshot (see docs/operations/PILOT_METADATA_SCHEMA.md).',
  })
  @IsObject()
  metadata!: Record<string, unknown>;
}
