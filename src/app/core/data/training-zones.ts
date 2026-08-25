export interface TrainingZone {
  nameKey: string;
  percentMin: number;
  percentMax: number;
  purposeKey: string;
}

export const TRAINING_ZONES: TrainingZone[] = [
  { nameKey: 'trainingZones.zone1', percentMin: 50, percentMax: 60, purposeKey: 'trainingZones.zone1Purpose' },
  { nameKey: 'trainingZones.zone2', percentMin: 60, percentMax: 70, purposeKey: 'trainingZones.zone2Purpose' },
  { nameKey: 'trainingZones.zone3', percentMin: 70, percentMax: 80, purposeKey: 'trainingZones.zone3Purpose' },
  { nameKey: 'trainingZones.zone4', percentMin: 80, percentMax: 90, purposeKey: 'trainingZones.zone4Purpose' },
  { nameKey: 'trainingZones.zone5', percentMin: 90, percentMax: 100, purposeKey: 'trainingZones.zone5Purpose' }
];
