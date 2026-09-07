import { Injectable } from '@angular/core';
import { Exercise, ExerciseEquipmentType, MuscleGroup } from '../models/exercise.model';
import { ExerciseWeightCategory } from '../models/tier-line-progression.model';
import { buildDefault531Plan } from '../data/default-531-plan';
import { buildDefault5x5Plan } from '../data/default-5x5-plan';
import { buildDefaultGzclpPlan } from '../data/default-gzclp-plan';
import { buildDefaultGreyskullPlan } from '../data/default-greyskull-plan';
import { buildDefaultNsunsPlan } from '../data/default-nsuns-plan';
import { buildDefaultHeavyDutyPlan } from '../data/default-heavyduty-plan';
import { buildDefaultHstPlan } from '../data/default-hst-plan';

const DB_NAME = 'trainings-app-db';
// Bumped from 28 with no new store/content of its own - some installs ended
// up stuck at 28 with linearProgression missing (its own bump's upgrade
// transaction never completed there), and a same-version reopen can't
// trigger onupgradeneeded to self-heal that. Forcing everyone through one
// more upgrade re-runs the "create any store not already present" loop
// below, which fixes those installs too.
// Jumped straight to 32 (skipping 30/31) because a live-reload during local
// testing briefly pushed those version numbers to an already-open real
// browser tab sharing this dev server, bumping its on-disk DB past 29 -
// IndexedDB never opens at a version lower than what's already stored, so
// this has to clear whatever the highest such leak reached.
// 33: re-seeds GZCLP with its now-stable day-template ids (see
// default-gzclp-plan.ts) - the reseed step below only runs on an actual
// upgrade, so this needs its own bump to take effect for existing installs.
// 34: backfills body region on the remaining default exercises and adds
// sourced description/photo content for Bench-Press and AB-Wheel (see
// DEFAULT_EXERCISE_SOURCED_CONTENT) - needs its own bump so every existing
// install picks this up on next load, not just brand-new ones.
// 35: the 34 backfill was landed as several separate file edits, each its
// own dev-server rebuild/live-reload - a real, already-open browser tab
// sharing this dev server could have reloaded on an intermediate edit
// (DB_VERSION already 34, backfill body not yet added), permanently
// advancing its stored version past the `< DB_VERSION` gate without the
// backfill ever running (same race as the 32/33 bumps above). Re-fires it
// for anyone caught in that gap.
// 36: verified locally that the 34/35 backfill correctly fills in genuinely
// empty fields (not just no-ops on already-healed rows).
// 37: adds sourced description/photo content for Cable-Row and Calf-Raises
// too (same DEFAULT_EXERCISE_SOURCED_CONTENT backfill as 34/35/36).
// 38: adds 5 more photo+description matches (Chin-Ups, Pull-Ups,
// Back-Extension, Barbell-Row, Dips) plus description-only content for 4
// more (Deadlift, Squat, Lat-Pull-Downs, Bent-Over-Dumbbell-Raise) - the
// backfill's "already applied" check now looks at sourceUrl rather than
// sourceImageUrl, since these last 4 never get an image at all.
// 39: adds description-only content for Standing-Leg-Curls (the only
// matching image found shows the lying/prone variant, not standing).
// 40: adds "Leg-Curls" as a new default exercise (the lying/prone variant
// image from 39 belongs here, not on Standing-Leg-Curls) - existing
// installs now get any name added to DEFAULT_EXERCISE_NAMES after their
// database was first created, not just brand-new installs.
// 41: adds original (non-sourced) descriptions for the 7 exercises no
// confident free/licensed match was found for (see
// DEFAULT_EXERCISE_DESCRIPTIONS).
// 42: backfills equipment type on the default exercises whose own
// name/description names exactly one piece of equipment (see
// DEFAULT_EXERCISE_EQUIPMENT_TYPES) - left unset on genuinely ambiguous
// ones (e.g. Chest-Supported-Rows, Neck-Curls/Neck-Extensions).
// 43: corrects Back-Extension's equipment from MACHINE (42's guess) to
// BODYWEIGHT.
// 44: backfills the primary muscle group on all default exercises (see
// DEFAULT_EXERCISE_MUSCLE_GROUPS).
// 45: the 44 backfill was landed as several separate file edits, each its
// own dev-server rebuild/live-reload - a real, already-open browser tab
// sharing this dev server could have reloaded on an intermediate edit
// (DB_VERSION already 44, backfill body not yet added), permanently
// advancing its stored version past the `< DB_VERSION` gate without the
// backfill ever running (same race as the 32/33 and 34/35 bumps above).
// Re-fires it for anyone caught in that gap.
// 46: adds 9 more default exercises (Bicep-Curls, Hip-Thrust,
// Lateral-Raise, Wrist-Curls, Leg-Press, Lunges, Incline-Bench-Press,
// Face-Pulls, Chest-Fly) to fill in muscle groups that had no or barely
// any default exercise (Biceps, Glutes, Forearms) - picked up by the
// existing "add missing name from DEFAULT_EXERCISE_NAMES" backfill.
// 47: adds the dumbbells store (Config page's new "Ausrüstung" > "Hanteln"
// tab) - picked up by the generic "create any store not already present"
// loop below.
// 48: 47 landed as separate file edits, each its own dev-server rebuild/
// live-reload - a real, already-open browser tab sharing this dev server
// could have reloaded on an intermediate edit (DB_VERSION already 47,
// dumbbells not yet added to STORES), permanently advancing its stored
// version past the `< DB_VERSION` gate without ever creating that store
// (same race as the 32/33, 34/35 and 44/45 bumps above). Re-fires it for
// anyone caught in that gap.
// 49: adds the plates store (Config page's "Ausrüstung" > "Scheiben" tab),
// alongside the dumbbells store, in the same file edit as the STORES entry
// below - avoids repeating the 47/48 race by landing both in one go.
// 50: 49 still landed as several file edits (STORES entry, component,
// template, translations) across one dev-server session - a real,
// already-open browser tab sharing this dev server reloaded on an
// intermediate edit and got stuck at version 49 without ever creating the
// plates store (same race as 32/33, 34/35, 44/45 and 47/48 above). Re-fires
// it for anyone caught in that gap.
const DB_VERSION = 50;

const DEFAULT_PLAN_BUILDERS = [
  buildDefault531Plan,
  buildDefault5x5Plan,
  buildDefaultGzclpPlan,
  buildDefaultGreyskullPlan,
  buildDefaultNsunsPlan,
  buildDefaultHeavyDutyPlan,
  buildDefaultHstPlan
];

export const STORES = {
  exercises: 'exercises',
  trainingPlans: 'trainingPlans',
  sessions: 'sessions',
  settings: 'settings',
  tierLineProgression: 'tierLineProgression',
  bodyWeightEntries: 'bodyWeightEntries',
  doubleProgression: 'doubleProgression',
  repGoalProgression: 'repGoalProgression',
  waveProgression: 'waveProgression',
  linearProgression: 'linearProgression',
  dumbbells: 'dumbbells',
  plates: 'plates'
} as const;

const STORE_KEY_PATHS: Partial<Record<string, string>> = {
  [STORES.tierLineProgression]: 'id'
};

const DEFAULT_EXERCISE_NAMES = [
  'Squat',
  'Deadlift',
  'Bench-Press',
  'Overhead-Press',
  'AB-Rollout',
  'AB-Wheel',
  'Back-Extension',
  'Barbell-Row',
  'Bent-Over-Dumbbell-Raise',
  'Cable-Push-Down',
  'Cable-Row',
  'Calf-Raises',
  'Chest-Supported-Rows',
  'Chin-Ups',
  'Lat-Pull-Downs',
  'Pull-Ups',
  'Dips',
  'Standing-Leg-Curls',
  'Leg-Curls',
  'Neck-Extensions',
  'Neck-Curls',
  'Triceps-Push-Down',
  'Bicep-Curls',
  'Hip-Thrust',
  'Lateral-Raise',
  'Wrist-Curls',
  'Leg-Press',
  'Lunges',
  'Incline-Bench-Press',
  'Face-Pulls',
  'Chest-Fly'
];

// The TierLine Basis plan's T1/T2 lifts need a body region to pick the right
// weight increment (2.5 kg lower body / 1 kg upper body). Seeded here so
// it's correct out of the box instead of requiring manual setup per install.
// Every default exercise gets a sensible region so the Config page's
// "Body Region" dropdown never starts blank - classified by primary muscle
// group, with core/neck work bucketed under Upper Body since the field is
// binary.
const DEFAULT_EXERCISE_WEIGHT_CATEGORIES: Partial<Record<string, ExerciseWeightCategory>> = {
  Squat: 'LOWER_BODY',
  Deadlift: 'LOWER_BODY',
  'Bench-Press': 'UPPER_BODY',
  'Overhead-Press': 'UPPER_BODY',
  'Cable-Row': 'UPPER_BODY',
  'Triceps-Push-Down': 'UPPER_BODY',
  'Chin-Ups': 'UPPER_BODY',
  'Pull-Ups': 'UPPER_BODY',
  'Cable-Push-Down': 'UPPER_BODY',
  'AB-Wheel': 'UPPER_BODY',
  'Chest-Supported-Rows': 'UPPER_BODY',
  'Barbell-Row': 'UPPER_BODY',
  Dips: 'UPPER_BODY',
  'Bent-Over-Dumbbell-Raise': 'UPPER_BODY',
  'Standing-Leg-Curls': 'LOWER_BODY',
  'Leg-Curls': 'LOWER_BODY',
  'AB-Rollout': 'UPPER_BODY',
  'Back-Extension': 'LOWER_BODY',
  'Lat-Pull-Downs': 'UPPER_BODY',
  'Neck-Curls': 'UPPER_BODY',
  'Calf-Raises': 'LOWER_BODY',
  'Neck-Extensions': 'UPPER_BODY',
  'Bicep-Curls': 'UPPER_BODY',
  'Hip-Thrust': 'LOWER_BODY',
  'Lateral-Raise': 'UPPER_BODY',
  'Wrist-Curls': 'UPPER_BODY',
  'Leg-Press': 'LOWER_BODY',
  Lunges: 'LOWER_BODY',
  'Incline-Bench-Press': 'UPPER_BODY',
  'Face-Pulls': 'UPPER_BODY',
  'Chest-Fly': 'UPPER_BODY'
};

// Best-effort equipment classification for the default exercises, based on
// what each one's own name/description actually specifies - left unset
// ("Keine Zuordnung") wherever an exercise's own description names more
// than one piece of equipment as valid (e.g. Chest-Supported-Rows: dumbbells
// or a machine) or the equipment is genuinely open-ended (Neck-Curls/
// Neck-Extensions), rather than guessing.
const DEFAULT_EXERCISE_EQUIPMENT_TYPES: Partial<Record<string, ExerciseEquipmentType>> = {
  Squat: 'BARBELL',
  Deadlift: 'BARBELL',
  'Bench-Press': 'BARBELL',
  'Overhead-Press': 'BARBELL',
  'Barbell-Row': 'BARBELL',
  // Distinguished from AB-Wheel by name/equipment on this app's own list -
  // AB-Rollout is the barbell-loaded version, AB-Wheel the dedicated wheel.
  'AB-Rollout': 'BARBELL',
  'Bent-Over-Dumbbell-Raise': 'DUMBBELL',
  'Chin-Ups': 'BODYWEIGHT',
  'Pull-Ups': 'BODYWEIGHT',
  Dips: 'BODYWEIGHT',
  'AB-Wheel': 'BODYWEIGHT',
  'Cable-Push-Down': 'MACHINE',
  'Cable-Row': 'MACHINE',
  'Triceps-Push-Down': 'MACHINE',
  'Lat-Pull-Downs': 'MACHINE',
  'Calf-Raises': 'MACHINE',
  'Leg-Curls': 'MACHINE',
  'Standing-Leg-Curls': 'MACHINE',
  'Back-Extension': 'BODYWEIGHT',
  'Bicep-Curls': 'BARBELL',
  'Hip-Thrust': 'BARBELL',
  'Lateral-Raise': 'DUMBBELL',
  'Wrist-Curls': 'DUMBBELL',
  'Leg-Press': 'MACHINE',
  Lunges: 'BODYWEIGHT',
  'Incline-Bench-Press': 'BARBELL',
  'Face-Pulls': 'MACHINE',
  'Chest-Fly': 'DUMBBELL'
};

// Primary-mover muscle group for each default exercise - a single best-fit
// choice for compound lifts that work more than one muscle (e.g. Squat is
// classified as Quadriceps even though glutes/hamstrings assist too), since
// the dropdown only allows one selection. Chin-Ups vs. Pull-Ups and Dips are
// deliberately split from their close relatives (Biceps/Triceps vs. Back) to
// keep the classification useful rather than lumping every pull/push
// exercise under the same group.
const DEFAULT_EXERCISE_MUSCLE_GROUPS: Partial<Record<string, MuscleGroup>> = {
  Squat: 'QUADRICEPS',
  Deadlift: 'HAMSTRINGS',
  'Bench-Press': 'CHEST',
  'Overhead-Press': 'SHOULDERS',
  'AB-Rollout': 'ABS',
  'AB-Wheel': 'ABS',
  'Back-Extension': 'BACK',
  'Barbell-Row': 'BACK',
  'Bent-Over-Dumbbell-Raise': 'SHOULDERS',
  'Cable-Push-Down': 'TRICEPS',
  'Cable-Row': 'BACK',
  'Calf-Raises': 'CALVES',
  'Chest-Supported-Rows': 'BACK',
  'Chin-Ups': 'BICEPS',
  'Lat-Pull-Downs': 'BACK',
  'Pull-Ups': 'BACK',
  Dips: 'TRICEPS',
  'Standing-Leg-Curls': 'HAMSTRINGS',
  'Leg-Curls': 'HAMSTRINGS',
  'Neck-Extensions': 'NECK',
  'Neck-Curls': 'NECK',
  'Triceps-Push-Down': 'TRICEPS',
  'Bicep-Curls': 'BICEPS',
  'Hip-Thrust': 'GLUTES',
  'Lateral-Raise': 'SHOULDERS',
  'Wrist-Curls': 'FOREARMS',
  'Leg-Press': 'QUADRICEPS',
  Lunges: 'QUADRICEPS',
  'Incline-Bench-Press': 'CHEST',
  'Face-Pulls': 'SHOULDERS',
  'Chest-Fly': 'CHEST'
};

interface SourcedExerciseContent {
  description: string;
  // Some matched entries have a good description but no clean, correctly-
  // matching image (e.g. the only available photo used different equipment
  // than the description, or turned out to be a mismatched/copyrighted
  // upload) - sourceLicense/sourceAttribution/sourceUrl still apply to the
  // description text itself either way, since that's also sourced content
  // requiring attribution under wger.de's CC-BY-SA license.
  sourceImageUrl?: string;
  sourceLicense: string;
  sourceAttribution: string;
  sourceUrl: string;
}

// Execution photo + description sourced from wger.de (an open, CC-BY-SA
// licensed exercise database) for the handful of default exercises with a
// confident, well-matched entry there - see ExercisesComponent for the
// fallback animated pictogram every other exercise uses instead. Photos are
// bundled locally under public/exercise-images rather than hotlinked, since
// wger.de doesn't reliably serve them to every network.
const DEFAULT_EXERCISE_SOURCED_CONTENT: Partial<Record<string, SourcedExerciseContent>> = {
  'Bench-Press': {
    description:
      'Lege dich auf die Bank, die Stange direkt über die Augen, die Knie etwas angewinkelt und die Füße fest auf dem Boden. Greife die Stange breit und lasse sie langsam und kontrolliert runter, dabei sollte die Stange kurz auf Brustwarzenhöhe den Körper berühren. Dann das Gewicht wieder hochdrücken bis die Arme durchgestreckt sind.\n\nBei hohem Gewicht, empfielt sich natürlich einen Spotter zu haben, der einen hilft falls man die Stange nicht alleine hochdrücken kann.\n\nMit der Breite des Griffs kann außerdem kontrolliert werden, welcher Bereich der Brust stärker belastet wird:\n\n* breiter Griff: äußere Brustmuskeln\n* enger Griff: innere Brustmuskeln und Trizeps',
    sourceImageUrl: '/exercise-images/bench-press.png',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'Everkinetic',
    sourceUrl: 'https://wger.de/en/exercise/73/view/'
  },
  'AB-Wheel': {
    description:
      'Ausgangsposition: Knie dich auf den Boden, mit dem Bauchroller vor dir. Greife den Roller: Halte die Griffe fest. Ausrollen: Rolle den Roller langsam nach vorn und strecke deinen Körper aus, während du den Rumpf angespannt hältst. Zurückkehren: Ziehe den Roller wieder zurück zu deinen Knien und halte die Spannung im Rumpf.',
    sourceImageUrl: '/exercise-images/ab-wheel.png',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'lhegedus',
    sourceUrl: 'https://wger.de/en/exercise/1573/view/'
  },
  'Cable-Row': {
    description:
      '1. Setze dich auf die Maschine, die Füße fest aufgesetzt und etwas mehr als schulterbreit. Drücke über die Fersen und spanne die Gesäßmuskulatur an. Greife den Kabelgriff.\n2. Sitze aufrecht mit leicht gebeugten Knien. Spanne Bauch und unteren Rücken an, um mit deinem Oberkörper einen rechten Winkel zum Boden zu halten.\n3. Rolle die Schultern nach hinten und unten. Ziehe sie beim Rudern zusammen und stelle dir vor, du würdest einen Stift zwischen ihnen einklemmen. Ziehe dabei den Griff zu dir heran, bis er knapp oberhalb deines Bauchnabels ankommt.\n4. Halte hier einen Moment inne, bevor du den Griff zurückführst, während du die Schulterblätter weiterhin zusammendrückst. Sobald du das Gewicht zum Stapel zurückgeführt hast, lass die Schulterblätter entspannen, ohne den Oberkörper nach vorne zu ziehen.\n5. Wiederhole die Bewegung.',
    sourceImageUrl: '/exercise-images/cable-row.jpg',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'Franpol',
    sourceUrl: 'https://wger.de/en/exercise/1117/view/'
  },
  'Calf-Raises': {
    description:
      'Die Füße werden auf die in der Maschine dafür vorgesehene Stelle positioniert, wobei man die Fersen (und damit die Wadenmuskeln) komplett nach unten austrecken kann. Halte den Körper gerade, mache kein Hohlkreuz und beuge die Beine nicht.\n\nZiehe nun die Wadenmuskeln zusammen und gehe so hoch es geht. Mache auf dem höchsten Punkt eine kurze Pause (1-2 sek.) und gehe dann runter.',
    sourceImageUrl: '/exercise-images/calf-raises.jpeg',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'clafal',
    sourceUrl: 'https://wger.de/en/exercise/622/view/'
  },
  'Chin-Ups': {
    description: 'Wie normale Klimmzüge, aber im Untergriff.',
    sourceImageUrl: '/exercise-images/chin-ups.png',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'Everkinetic',
    sourceUrl: 'https://wger.de/en/exercise/152/view/'
  },
  'Pull-Ups': {
    description:
      'Greife die Klimmzugstange mit breitem Griff, der Körper hängt zunächst frei nach unten. Ziehe nun die Brust raus und bringe den Körper nach oben, bis dein Kinn über der Stange liegt (oder der Nacken sie berührt, wenn du nach hinten gezogen hast), gehe nun langsam nach unten und wiederhole.',
    sourceImageUrl: '/exercise-images/pull-ups.jpg',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'wger.de',
    sourceUrl: 'https://wger.de/en/exercise/475/view/'
  },
  'Back-Extension': {
    description:
      'Lege dich auf das Polster so, dass der Bauchnabel kurz vor der Vorderkante liegt, der Oberkörper hängt frei nach unten. Spanne die gesamte Rückenmuskulatur an, und bringe den Oberkörper nach oben bis er waagerecht ist (nicht höher). Gehe nun langsam wieder nach unten (Muskelanspannung nicht vergessen).',
    sourceImageUrl: '/exercise-images/back-extension.png',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'Everkinetic',
    sourceUrl: 'https://wger.de/en/exercise/301/view/'
  },
  'Barbell-Row': {
    description:
      'Greife die Langhantel mit breitem (etwas mehr als Schulterbreit) Griff und beuge dich nach vorne. Dabei ist der Oberkörper nicht ganz waagerecht, sondern ein bisschen steiler, der Kopf schaut nach vorn und die Brust ist rausgestreckt. Ziehe nun das Gewicht in Richtung Bauchnabel. Schwinge während der Bewegung den Oberkörper nicht und halte die Arme dicht am Körper, wenn du sie hochziehst. Bringe die Hantel langsam wieder nach unten.',
    sourceImageUrl: '/exercise-images/barbell-row.png',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'Everkinetic',
    sourceUrl: 'https://wger.de/en/exercise/83/view/'
  },
  Dips: {
    description:
      'Greife die Stangen an einer engen Stelle und drücke dich hoch. Strecke dabei die Arme nicht ganz aus, dann bleiben während des gesamten Bewegungsablaufs die Muskeln immer unter Spannung. Beuge nun die Arme und gehe so tief wie möglich runter, die Ellenbogen zeigen nach hinten. Du kannst an dieser Stelle einige Sekunden bleiben, bevor du die Übung weitermachst.',
    sourceImageUrl: '/exercise-images/dips.png',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'cshep442',
    sourceUrl: 'https://wger.de/en/exercise/194/view/'
  },
  // No clean, matching image found for these - the only candidate photo
  // either used different equipment than the text describes (Deadlift) or
  // was a generic muscle-group diagram rather than an execution photo
  // (Squat, Lat-Pull-Downs, Bent-Over-Dumbbell-Raise). Description only.
  Deadlift: {
    description:
      'Stelle dich mit etwas mehr als schulterbreitem Stand vor der Stange, die Füße zeigen leicht nach außen, die Stange ist direkt darüber und sehr nahe am Schienbein. Beuge die Knie (zeigen ebenfalls etwas nach außen) und neige den Oberkörper (bleibt während der ganzen Übung gerade). Greife die Stange schulterbreit mit einem Unter- und einem Obergriff.\n\nZiehe nun die Stange nach oben. An der höchsten Stelle mache ein leichtes Hohlkreuz und drücke die Schultern nach hinten. Gehe wieder runter, wobei du darauf achtest, dass der Rücken gerade bleibt und sich nicht krümmt. Du kannst unten angekommen eine kleine Pause einlegen oder sofort weitermachen.',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'wger.de',
    sourceUrl: 'https://wger.de/en/exercise/184/view/'
  },
  Squat: {
    description:
      'Stelle die Halterung der Langhantel auf so eine Höhe ein, dass du sie bequem raus- und wieder reinbringen kannst. Bereite dich vor: die Stange ist etwas tiefer als Schulterhöhe, die Füße sind ziemlich auseinander und zeigen leicht nach außen, der Kopf ist im Nacken und schaut nach vorne/oben, die Brust wird nach außen gebracht.\n\nGehe nun langsam runter, bis der Oberschenkel einen rechten Winkel bildet, nicht tiefer. Die Knie zeigen leicht nach außen, dein Gesäß nach hinten. Mache eine kleine Pause und gehe mit so viel Energie wie du aufbringen kannst, wieder nach oben. Nach 2 Sekunden Pause gehe wieder runter.',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'wger.de',
    sourceUrl: 'https://wger.de/en/exercise/615/view/'
  },
  'Lat-Pull-Downs': {
    description:
      'Aufrechte Sitzposition, Oberkörper leicht nach hinten beugen, Stange im Obergriff fassen, Stange vor dem Kopf nach unten zum Brustbein ziehen, Stange zurückführen, bis Ellenbogen leicht gebeugt.',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'wger.de',
    sourceUrl: 'https://wger.de/en/exercise/723/view/'
  },
  'Bent-Over-Dumbbell-Raise': {
    description:
      'Setze dich auf den Rand einer Flachbank und beuge den Körper so weit nach vorne, dass er parallel zum Boden ist. Nimm nun die Hanteln und hebe sie seitwärts bis etwas über Schulterhöhe. Gehe langsam wieder runter.\n\nEs ist wichtig, während der Übung die Arme nicht nach vorn oder nach hinten zu bewegen, sie sollten stets einen rechten Winkel mit dem Körper haben. Wie beim Seitheben im Stehen sollten sich die Handflächen nicht drehen, sie zeigen also immer zum Boden oder zum Körper.',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'wger.de',
    sourceUrl: 'https://wger.de/en/exercise/82/view/'
  },
  // Only image found for "Leg Curl" shows the lying/prone machine variant,
  // not the standing one this exercise is named for - description only,
  // since the text itself doesn't specify a body position.
  'Standing-Leg-Curls': {
    description:
      'Der Beinbeuger, auch als Hamstring-Curl bekannt, ist eine Isolationsübung, die auf die hintere Oberschenkelmuskulatur abzielt. Bei der Übung wird der Unterschenkel gegen Widerstand in Richtung Gesäß gebeugt. Weitere Übungen, mit denen sich die hintere Oberschenkelmuskulatur stärken lässt, sind das Glute-Ham-Raise und das Kreuzheben.',
    sourceLicense: 'CC-BY-SA 3.0',
    sourceAttribution: 'BFad07',
    sourceUrl: 'https://wger.de/en/exercise/364/view/'
  },
  // Same wger.de exercise (364) as Standing-Leg-Curls above, but here for
  // the lying/prone machine variant its image actually shows.
  'Leg-Curls': {
    description:
      'Der Beinbeuger, auch als Hamstring-Curl bekannt, ist eine Isolationsübung, die auf die hintere Oberschenkelmuskulatur abzielt. Bei der Übung wird der Unterschenkel gegen Widerstand in Richtung Gesäß gebeugt. Weitere Übungen, mit denen sich die hintere Oberschenkelmuskulatur stärken lässt, sind das Glute-Ham-Raise und das Kreuzheben.',
    sourceImageUrl: '/exercise-images/leg-curls.png',
    sourceLicense: 'CC-BY-SA 4.0',
    sourceAttribution: 'wger.de',
    sourceUrl: 'https://wger.de/en/exercise/364/view/'
  }
};

// Own descriptions for exercises no free/openly-licensed database entry
// could be confidently matched to (see ExercisesComponent's edit history) -
// no source/license fields, since this text isn't reused from anywhere.
const DEFAULT_EXERCISE_DESCRIPTIONS: Partial<Record<string, string>> = {
  'Overhead-Press': `Stelle dich schulterbreit hin, die Langhantel liegt auf Schlüsselbeinhöhe vor dem Körper, Griff etwas breiter als schulterbreit. Spanne Rumpf und Gesäß an und drücke die Hantel gerade nach oben, bis die Arme vollständig gestreckt sind - der Kopf schiebt sich beim Durchdrücken leicht nach vorne unter die Stange. Senke die Hantel kontrolliert wieder auf Schlüsselbeinhöhe ab.`,
  'AB-Rollout': `Knie dich auf den Boden und greife die Langhantel (mit aufgesetzten Gewichtsscheiben) oder den Ab-Roller schulterbreit. Rolle das Gerät langsam nach vorne, während du den Körper streckst und den Rumpf fest anspannst - der Rücken bleibt dabei gerade, kein Hohlkreuz. Rolle zurück in die Ausgangsposition, kurz bevor der Körper den Boden berührt.`,
  'Cable-Push-Down': `Stelle dich vor den Kabelzug mit hoch eingehängter Stange oder Seil, die Ellbogen eng am Körper und im rechten Winkel gebeugt. Drücke das Gewicht nach unten, bis die Arme fast vollständig gestreckt sind, ohne die Ellbogen dabei nach vorne wegzubewegen. Führe das Gewicht kontrolliert wieder nach oben.`,
  'Triceps-Push-Down': `Stelle dich aufrecht vor den Kabelzug mit einer Stange oder einem Seil an der oberen Umlenkrolle, die Oberarme fest am Körper. Strecke die Unterarme nach unten, bis die Arme durchgestreckt sind, ohne die Ellbogen zu bewegen. Führe die Stange langsam wieder nach oben.`,
  'Chest-Supported-Rows': `Lege dich mit der Brust auf eine Schrägbank oder eine Rudermaschine mit Brustpolster. Greife die Hanteln oder den Griff und ziehe die Ellbogen nach hinten, während du die Schulterblätter zusammenziehst - der Oberkörper bleibt dabei ruhig auf der Auflage liegen. Senke das Gewicht kontrolliert wieder ab.`,
  'Neck-Extensions': `Setze oder knie dich an ein Nackengerät oder halte ein Widerstandsband am Hinterkopf. Neige den Kopf zunächst leicht nach vorne und drücke ihn dann langsam gegen den Widerstand nach hinten, bis der Nacken gestreckt ist. Führe die Bewegung kontrolliert wieder zurück.`,
  'Neck-Curls': `Lege dich mit dem Gesicht nach oben, ein Widerstandsband oder ein leichtes Gewicht liegt an der Stirn an. Beuge den Kopf langsam nach vorne in Richtung Brust, bis eine leichte Dehnung im Nacken spürbar ist, und führe ihn dann kontrolliert zurück in die Ausgangsposition.`,
  'Bicep-Curls': `Stehe aufrecht, die Langhantel im Untergriff vor dem Körper haltend, die Ellbogen eng am Oberkörper. Beuge die Arme und hebe die Stange kontrolliert bis zur Schulter, ohne den Oberkörper zu schwingen. Senke die Stange langsam wieder ab, bis die Arme fast vollständig gestreckt sind.`,
  'Hip-Thrust': `Setze dich mit dem oberen Rücken an eine Bank gelehnt auf den Boden, eine gepolsterte Langhantel liegt über den Hüften. Stelle die Füße hüftbreit auf und drücke die Hüfte nach oben, bis der Körper von den Schultern bis zu den Knien eine gerade Linie bildet. Senke die Hüfte kontrolliert wieder ab, ohne den Boden ganz zu berühren.`,
  'Lateral-Raise': `Stehe aufrecht, in jeder Hand eine Kurzhantel seitlich am Körper. Hebe die Arme mit leicht gebeugten Ellbogen seitlich an, bis sie etwa auf Schulterhöhe sind. Senke die Arme langsam wieder kontrolliert ab.`,
  'Wrist-Curls': `Setze dich hin und lege die Unterarme mit den Handflächen nach oben auf die Oberschenkel oder eine Bank, die Handgelenke ragen über die Kante hinaus. Halte in jeder Hand eine Kurzhantel und beuge die Handgelenke nach oben. Senke die Hände langsam wieder ab, bis die Handgelenke leicht überstreckt sind.`,
  'Leg-Press': `Setze dich in die Beinpresse, die Füße schulterbreit auf der Fußplatte. Löse die Arretierung und beuge die Knie, bis sie etwa einen rechten Winkel bilden, ohne den unteren Rücken von der Rückenlehne abzuheben. Drücke die Platte wieder nach oben, bis die Beine fast, aber nicht vollständig gestreckt sind.`,
  Lunges: `Stehe aufrecht, die Hände in die Hüften gestützt. Mache einen großen Schritt nach vorne und senke den Körper ab, bis beide Knie etwa einen rechten Winkel bilden, das hintere Knie knapp über dem Boden. Drücke dich über die vordere Ferse wieder zurück in die Ausgangsposition.`,
  'Incline-Bench-Press': `Lege dich auf eine Schrägbank mit etwa 30-45 Grad Neigung und greife die Langhantel etwas breiter als schulterbreit. Senke die Stange kontrolliert bis zum oberen Brustbereich ab. Drücke sie wieder nach oben, bis die Arme fast vollständig gestreckt sind.`,
  'Face-Pulls': `Stelle dich vor den Kabelzug mit einem Seilgriff auf Kopfhöhe eingehängt. Ziehe das Seil zum Gesicht, während du die Ellbogen hoch und nach außen führst und die Schulterblätter zusammenziehst. Führe das Seil kontrolliert wieder zurück in die Ausgangsposition.`,
  'Chest-Fly': `Lege dich auf eine Flachbank, in jeder Hand eine Kurzhantel mit den Handflächen zueinander über der Brust. Senke die Arme mit leicht gebeugten Ellbogen seitlich ab, bis eine Dehnung in der Brust spürbar ist. Führe die Hanteln wieder in einer bogenförmigen Bewegung über der Brust zusammen.`
};

export type StoreName = (typeof STORES)[keyof typeof STORES];

// Shared by the new-database seed loop and the existing-install backfill
// below, so a name added to DEFAULT_EXERCISE_NAMES after an install's
// database was first created still gets built the same way.
function buildDefaultExercise(name: string): Exercise {
  const sourced = DEFAULT_EXERCISE_SOURCED_CONTENT[name];
  const plainDescription = DEFAULT_EXERCISE_DESCRIPTIONS[name];
  return {
    id: crypto.randomUUID(),
    name,
    category: '',
    weightCategory: DEFAULT_EXERCISE_WEIGHT_CATEGORIES[name],
    equipmentType: DEFAULT_EXERCISE_EQUIPMENT_TYPES[name],
    muscleGroup: DEFAULT_EXERCISE_MUSCLE_GROUPS[name],
    ...(sourced
      ? {
          description: sourced.description,
          sourceImageUrl: sourced.sourceImageUrl,
          sourceLicense: sourced.sourceLicense,
          sourceAttribution: sourced.sourceAttribution,
          sourceUrl: sourced.sourceUrl
        }
      : plainDescription
        ? { description: plainDescription }
        : {})
  };
}

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

@Injectable({ providedIn: 'root' })
export class IndexedDbService {
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.openDatabase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const isNewDatabase = event.oldVersion === 0;

        // Recreate any store whose actual keyPath no longer matches
        // STORE_KEY_PATHS (e.g. tierLineProgression moved from exerciseId to
        // a composite `${exerciseId}:${tier}` id, since the same exercise can
        // rotate through different tier slots with independent progression).
        // Checking the real keyPath instead of the version number is what
        // actually matters here — relying on a version-range guard silently
        // failed to fire for databases that had already reached the target
        // version with the stale keyPath. No store affected by this had real
        // user data yet, so dropping and recreating loses nothing.
        for (const storeName of Object.values(STORES)) {
          const desiredKeyPath = STORE_KEY_PATHS[storeName] ?? 'id';
          if (
            db.objectStoreNames.contains(storeName) &&
            request.transaction!.objectStore(storeName).keyPath !== desiredKeyPath
          ) {
            db.deleteObjectStore(storeName);
          }
        }

        for (const storeName of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: STORE_KEY_PATHS[storeName] ?? 'id' });
          }
        }

        if (isNewDatabase) {
          const exercisesStore = request.transaction!.objectStore(STORES.exercises);
          const exerciseIdByName = new Map<string, string>();
          for (const name of DEFAULT_EXERCISE_NAMES) {
            const exercise = buildDefaultExercise(name);
            exercisesStore.add(exercise);
            exerciseIdByName.set(name, exercise.id);
          }
          const trainingPlansStore = request.transaction!.objectStore(STORES.trainingPlans);
          for (const buildPlan of DEFAULT_PLAN_BUILDERS) {
            const defaultPlan = buildPlan(exerciseIdByName);
            if (defaultPlan) {
              trainingPlansStore.put(defaultPlan);
            }
          }
        } else {
          if (event.oldVersion < DB_VERSION && db.objectStoreNames.contains(STORES.exercises)) {
            // Add any name from DEFAULT_EXERCISE_NAMES that doesn't exist yet
            // on this install - covers a new default exercise introduced
            // after the database was first created (e.g. Leg-Curls added
            // alongside the already-seeded Standing-Leg-Curls).
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.getAll().onsuccess = (getAllEvent) => {
              const existingNames = new Set(
                (getAllEvent.target as IDBRequest<Exercise[]>).result.map((exercise) => exercise.name)
              );
              for (const name of DEFAULT_EXERCISE_NAMES) {
                if (!existingNames.has(name)) {
                  exercisesStore.add(buildDefaultExercise(name));
                }
              }
            };
          }

          if (event.oldVersion < 8 && db.objectStoreNames.contains(STORES.exercises)) {
            // Backfill weightCategory on existing installs' Squat/Deadlift/Bench-Press/
            // Overhead-Press rows so TierLine progression picks the right increment
            // without the user having to set it manually first.
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.openCursor().onsuccess = (cursorEvent) => {
              const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
              if (!cursor) {
                return;
              }
              const exercise = cursor.value as Exercise;
              const defaultCategory = DEFAULT_EXERCISE_WEIGHT_CATEGORIES[exercise.name];
              if (defaultCategory && !exercise.weightCategory) {
                cursor.update({ ...exercise, weightCategory: defaultCategory });
              }
              cursor.continue();
            };
          }

          if (event.oldVersion < DB_VERSION && db.objectStoreNames.contains(STORES.exercises)) {
            // Self-healing backfill: fills in body region and sourced
            // description/photo for the built-in exercises whenever that
            // field is still empty, without touching anything the user has
            // already changed - per-field rather than whole-record (unlike
            // the training-plan reseed below) since these rows aren't
            // read-only and can carry real user edits.
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.openCursor().onsuccess = (cursorEvent) => {
              const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue>).result;
              if (!cursor) {
                return;
              }
              const exercise = cursor.value as Exercise;
              const defaultCategory = DEFAULT_EXERCISE_WEIGHT_CATEGORIES[exercise.name];
              const sourced = DEFAULT_EXERCISE_SOURCED_CONTENT[exercise.name];
              let updated = exercise;
              if (defaultCategory && !updated.weightCategory) {
                updated = { ...updated, weightCategory: defaultCategory };
              }
              if (sourced && !updated.sourceUrl) {
                updated = {
                  ...updated,
                  description: updated.description ?? sourced.description,
                  sourceImageUrl: sourced.sourceImageUrl,
                  sourceLicense: sourced.sourceLicense,
                  sourceAttribution: sourced.sourceAttribution,
                  sourceUrl: sourced.sourceUrl
                };
              }
              const plainDescription = DEFAULT_EXERCISE_DESCRIPTIONS[exercise.name];
              if (!sourced && plainDescription && !updated.description) {
                updated = { ...updated, description: plainDescription };
              }
              const defaultEquipment = DEFAULT_EXERCISE_EQUIPMENT_TYPES[exercise.name];
              if (defaultEquipment && !updated.equipmentType) {
                updated = { ...updated, equipmentType: defaultEquipment };
              }
              // Back-Extension's equipment was originally auto-classified as
              // MACHINE by the very backfill above (in version 42) - corrected
              // to BODYWEIGHT per explicit feedback. Only overwrites that
              // exact prior auto-set value, never a different choice the user
              // may have since picked themselves.
              if (exercise.name === 'Back-Extension' && updated.equipmentType === 'MACHINE') {
                updated = { ...updated, equipmentType: 'BODYWEIGHT' };
              }
              const defaultMuscleGroup = DEFAULT_EXERCISE_MUSCLE_GROUPS[exercise.name];
              if (defaultMuscleGroup && !updated.muscleGroup) {
                updated = { ...updated, muscleGroup: defaultMuscleGroup };
              }
              if (updated !== exercise) {
                cursor.update(updated);
              }
              cursor.continue();
            };
          }

          if (
            // Always compares against the live DB_VERSION constant rather
            // than a hardcoded number that must be bumped in lockstep — a
            // mismatch here once let a live-reload race skip this backfill
            // for an already-open real browser, permanently missing a content
            // update (see project memory: default-training-plans).
            event.oldVersion < DB_VERSION &&
            db.objectStoreNames.contains(STORES.exercises) &&
            db.objectStoreNames.contains(STORES.trainingPlans)
          ) {
            // Seed the default plans (5/3/1, 5x5, GZCLP, GreySkull LP, nSuns,
            // Heavy Duty, HST) for existing installs too, looking up the lift
            // ids by name since they're randomly generated per install.
            // Re-running this is harmless/idempotent (put), so it also
            // re-adds any default plan a restore/import may have dropped, and
            // picks up content changes (e.g. attribution added to a plan's
            // name) that the self-healing
            // check alone wouldn't apply to an already-seeded plan.
            const exercisesStore = request.transaction!.objectStore(STORES.exercises);
            exercisesStore.getAll().onsuccess = (getAllEvent) => {
              const allExercises = (getAllEvent.target as IDBRequest<Exercise[]>).result;
              const exerciseIdByName = new Map(allExercises.map((exercise) => [exercise.name, exercise.id]));
              const trainingPlansStore = request.transaction!.objectStore(STORES.trainingPlans);
              for (const buildPlan of DEFAULT_PLAN_BUILDERS) {
                const defaultPlan = buildPlan(exerciseIdByName);
                if (defaultPlan) {
                  trainingPlansStore.put(defaultPlan);
                }
              }
            };
          }
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // A long-lived tab (this app's dev server hot-reloads code without a
        // full page refresh, so a tab can stay open across many schema
        // bumps) keeps this exact connection object even after a later
        // version adds a new store elsewhere - without closing it here,
        // every future open() for that newer version stays stuck "blocked"
        // forever, and this connection's own transaction() calls keep
        // throwing NotFoundError for any store added since it was opened.
        // Closing lets the newer open() proceed; getStore()'s callers still
        // need a fresh page load to pick up a new dbPromise pointing at it.
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async getStore(storeName: StoreName, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbPromise;
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  private async runWriteTransaction(storeName: StoreName, work: (store: IDBObjectStore) => void): Promise<void> {
    const db = await this.dbPromise;
    const transaction = db.transaction(storeName, 'readwrite');
    work(transaction.objectStore(storeName));
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAll<T>(storeName: StoreName): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    return toPromise(store.getAll() as IDBRequest<T[]>);
  }

  async get<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const store = await this.getStore(storeName, 'readonly');
    return toPromise(store.get(id) as IDBRequest<T | undefined>);
  }

  async add<T>(storeName: StoreName, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.add(item));
  }

  async put<T>(storeName: StoreName, item: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.put(item));
  }

  async delete(storeName: StoreName, id: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    await toPromise(store.delete(id));
  }

  async exportAll(): Promise<Record<StoreName, unknown[]>> {
    const entries = await Promise.all(
      Object.values(STORES).map(async (storeName) => [storeName, await this.getAll(storeName)] as const)
    );
    return Object.fromEntries(entries) as Record<StoreName, unknown[]>;
  }

  async importAll(data: Partial<Record<StoreName, unknown[]>>): Promise<void> {
    for (const storeName of Object.values(STORES)) {
      const items = data[storeName];
      if (!items) {
        continue;
      }
      await this.runWriteTransaction(storeName, (store) => {
        store.clear();
        for (const item of items) {
          store.put(item);
        }
      });
    }
  }
}
