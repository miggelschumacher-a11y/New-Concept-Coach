export interface TrainingZone {
  nameKey: string;
  percentRange: string;
  purposeKey: string;
}

export const TRAINING_ZONES: TrainingZone[] = [
  { nameKey: 'trainingZones.zone1', percentRange: '50–60 %', purposeKey: 'trainingZones.zone1Purpose' },
  { nameKey: 'trainingZones.zone2', percentRange: '60–70 %', purposeKey: 'trainingZones.zone2Purpose' },
  { nameKey: 'trainingZones.zone3', percentRange: '70–80 %', purposeKey: 'trainingZones.zone3Purpose' },
  { nameKey: 'trainingZones.zone4', percentRange: '80–90 %', purposeKey: 'trainingZones.zone4Purpose' },
  { nameKey: 'trainingZones.zone5', percentRange: '90–100 %', purposeKey: 'trainingZones.zone5Purpose' }
];
