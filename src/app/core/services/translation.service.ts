import { Injectable } from '@angular/core';
import { Language, SettingsService } from './settings.service';

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' }
];

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    'nav.sessions': 'Training Sessions',
    'nav.trainingPlans': 'Training Plans',
    'nav.exercises': 'Exercises',
    'nav.config': 'Configuration',

    'common.add': 'Add',
    'common.delete': 'Delete',
    'common.name': 'Name',

    'exercises.title': 'Exercises',
    'exercises.category': 'Category',
    'exercises.empty': 'No exercises yet.',

    'trainingPlans.title': 'Training Plans',
    'trainingPlans.description': 'Description',
    'trainingPlans.empty': 'No training plans yet.',

    'sessions.title': 'Training Sessions',
    'sessions.dateTime': 'Date & Time',
    'sessions.empty': 'No training sessions yet.',
    'sessions.weightLifted': 'Weight lifted',
    'sessions.notes': 'Notes',
    'sessions.exercisesLabel': 'Exercises',
    'sessions.noExercisesHint': 'No exercises in master data yet.',
    'sessions.removeExercise': 'Remove exercise',
    'sessions.setsWord': 'sets',
    'sessions.warmupSets': 'Warm-up Sets',
    'sessions.workingSets': 'Working Sets',
    'sessions.cooldownSets': 'Cooldown Sets',
    'sessions.countWarmup': 'Count warm-up set',
    'sessions.countCooldown': 'Count cooldown set',
    'sessions.reps': 'Reps',
    'sessions.setLabel': 'Set',
    'sessions.removeSet': 'Remove set',
    'sessions.addSet': 'Add Set',
    'sessions.pause': 'Pause',
    'sessions.resume': 'Resume',
    'sessions.finish': 'Finish Session',
    'sessions.finished': 'Finished',
    'sessions.confirmFinishQuestion': 'Really finish?',
    'sessions.confirmYes': 'Yes, finish',
    'sessions.confirmCancel': 'Cancel',

    'config.title': 'Configuration',
    'config.display': 'Display',
    'config.weightUnit': 'Weight Unit',
    'config.dateFormat': 'Date Format',
    'config.dateFormatEU': 'DD.MM.YYYY (21.08.2026)',
    'config.dateFormatUS': 'MM/DD/YYYY (08/21/2026)',
    'config.language': 'Language',
    'config.data': 'Data',
    'config.dataDescription': 'Export all local data as a file or restore a previously exported backup.',
    'config.export': 'Export Data',
    'config.import': 'Import Data',
    'config.reset': 'Delete All Data',
    'config.exportSuccess': 'Data exported.',
    'config.importSuccess': 'Data imported.',
    'config.importError': 'Import failed: invalid file.',
    'config.resetConfirm': 'Really delete all local data irrevocably?',
    'config.resetSuccess': 'All data deleted.'
  },
  de: {
    'nav.sessions': 'Trainingseinheiten',
    'nav.trainingPlans': 'Trainingspläne',
    'nav.exercises': 'Übungen',
    'nav.config': 'Konfiguration',

    'common.add': 'Hinzufügen',
    'common.delete': 'Löschen',
    'common.name': 'Name',

    'exercises.title': 'Übungen',
    'exercises.category': 'Kategorie',
    'exercises.empty': 'Noch keine Übungen vorhanden.',

    'trainingPlans.title': 'Trainingspläne',
    'trainingPlans.description': 'Beschreibung',
    'trainingPlans.empty': 'Noch keine Trainingspläne vorhanden.',

    'sessions.title': 'Trainingseinheiten',
    'sessions.dateTime': 'Datum & Uhrzeit',
    'sessions.empty': 'Noch keine Trainingseinheiten vorhanden.',
    'sessions.weightLifted': 'Gehobenes Gewicht',
    'sessions.notes': 'Notizen',
    'sessions.exercisesLabel': 'Übungen',
    'sessions.noExercisesHint': 'Noch keine Übungen in den Stammdaten angelegt.',
    'sessions.removeExercise': 'Übung entfernen',
    'sessions.setsWord': 'Sätze',
    'sessions.warmupSets': 'Aufwärm-Sätze',
    'sessions.workingSets': 'Arbeitssätze',
    'sessions.cooldownSets': 'Cooldown-Sätze',
    'sessions.countWarmup': 'Aufwärmsatz mitzählen',
    'sessions.countCooldown': 'Cool-Down-Satz mitzählen',
    'sessions.reps': 'Wdh.',
    'sessions.setLabel': 'Satz',
    'sessions.removeSet': 'Satz entfernen',
    'sessions.addSet': 'Satz hinzufügen',
    'sessions.pause': 'Pausieren',
    'sessions.resume': 'Fortsetzen',
    'sessions.finish': 'Session beenden',
    'sessions.finished': 'Beendet',
    'sessions.confirmFinishQuestion': 'Wirklich beenden?',
    'sessions.confirmYes': 'Ja, beenden',
    'sessions.confirmCancel': 'Abbrechen',

    'config.title': 'Konfiguration',
    'config.display': 'Anzeige',
    'config.weightUnit': 'Gewichtseinheit',
    'config.dateFormat': 'Datumsformat',
    'config.dateFormatEU': 'TT.MM.JJJJ (21.08.2026)',
    'config.dateFormatUS': 'MM/TT/JJJJ (08/21/2026)',
    'config.language': 'Sprache',
    'config.data': 'Daten',
    'config.dataDescription':
      'Exportiere alle lokalen Daten als Datei oder stelle eine zuvor exportierte Sicherung wieder her.',
    'config.export': 'Daten exportieren',
    'config.import': 'Daten importieren',
    'config.reset': 'Alle Daten löschen',
    'config.exportSuccess': 'Daten wurden exportiert.',
    'config.importSuccess': 'Daten wurden importiert.',
    'config.importError': 'Import fehlgeschlagen: ungültige Datei.',
    'config.resetConfirm': 'Wirklich alle lokalen Daten unwiderruflich löschen?',
    'config.resetSuccess': 'Alle Daten wurden gelöscht.'
  },
  es: {
    'nav.sessions': 'Sesiones de entrenamiento',
    'nav.trainingPlans': 'Planes de entrenamiento',
    'nav.exercises': 'Ejercicios',
    'nav.config': 'Configuración',

    'common.add': 'Añadir',
    'common.delete': 'Eliminar',
    'common.name': 'Nombre',

    'exercises.title': 'Ejercicios',
    'exercises.category': 'Categoría',
    'exercises.empty': 'Aún no hay ejercicios.',

    'trainingPlans.title': 'Planes de entrenamiento',
    'trainingPlans.description': 'Descripción',
    'trainingPlans.empty': 'Aún no hay planes de entrenamiento.',

    'sessions.title': 'Sesiones de entrenamiento',
    'sessions.dateTime': 'Fecha y hora',
    'sessions.empty': 'Aún no hay sesiones de entrenamiento.',
    'sessions.weightLifted': 'Peso levantado',
    'sessions.notes': 'Notas',
    'sessions.exercisesLabel': 'Ejercicios',
    'sessions.noExercisesHint': 'Aún no hay ejercicios en los datos maestros.',
    'sessions.removeExercise': 'Eliminar ejercicio',
    'sessions.setsWord': 'series',
    'sessions.warmupSets': 'Series de calentamiento',
    'sessions.workingSets': 'Series de trabajo',
    'sessions.cooldownSets': 'Series de enfriamiento',
    'sessions.countWarmup': 'Contar serie de calentamiento',
    'sessions.countCooldown': 'Contar serie de enfriamiento',
    'sessions.reps': 'Reps',
    'sessions.setLabel': 'Serie',
    'sessions.removeSet': 'Eliminar serie',
    'sessions.addSet': 'Añadir serie',
    'sessions.pause': 'Pausar',
    'sessions.resume': 'Reanudar',
    'sessions.finish': 'Finalizar sesión',
    'sessions.finished': 'Finalizada',
    'sessions.confirmFinishQuestion': '¿Finalizar de verdad?',
    'sessions.confirmYes': 'Sí, finalizar',
    'sessions.confirmCancel': 'Cancelar',

    'config.title': 'Configuración',
    'config.display': 'Pantalla',
    'config.weightUnit': 'Unidad de peso',
    'config.dateFormat': 'Formato de fecha',
    'config.dateFormatEU': 'DD.MM.AAAA (21.08.2026)',
    'config.dateFormatUS': 'MM/DD/AAAA (08/21/2026)',
    'config.language': 'Idioma',
    'config.data': 'Datos',
    'config.dataDescription':
      'Exporta todos los datos locales como archivo o restaura una copia de seguridad exportada anteriormente.',
    'config.export': 'Exportar datos',
    'config.import': 'Importar datos',
    'config.reset': 'Eliminar todos los datos',
    'config.exportSuccess': 'Datos exportados.',
    'config.importSuccess': 'Datos importados.',
    'config.importError': 'Error al importar: archivo no válido.',
    'config.resetConfirm': '¿Eliminar realmente todos los datos locales de forma irrevocable?',
    'config.resetSuccess': 'Todos los datos eliminados.'
  }
};

@Injectable({ providedIn: 'root' })
export class TranslationService {
  constructor(private readonly settingsService: SettingsService) {}

  translate(key: string): string {
    const language = this.settingsService.getSettings().language;
    return TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  }
}
