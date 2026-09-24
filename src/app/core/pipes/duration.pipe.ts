import { Pipe, PipeTransform } from '@angular/core';
import { formatDuration } from '../utils/duration-mask.util';

// Seconds as h:mm:ss (see duration-mask.util) - takes the number itself or
// the numeric string several display helpers return, and '' for a missing
// value so an optional field stays blank instead of showing 00:00:00.
@Pipe({ name: 'duration', standalone: true })
export class DurationPipe implements PipeTransform {
  transform(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    const seconds = typeof value === 'number' ? value : parseInt(value, 10);
    return Number.isFinite(seconds) ? formatDuration(seconds) : '';
  }
}
