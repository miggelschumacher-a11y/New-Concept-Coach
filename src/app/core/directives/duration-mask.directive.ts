import { Directive, HostListener } from '@angular/core';
import { maskDurationInput } from '../utils/duration-mask.util';

// Turns a text input into an h:mm:ss field (see duration-mask.util for the
// exact rules) - reformats the value on every keystroke and keeps the caret
// at the end, since the mask fills from the right. Applied via the
// `durationMask` attribute to every seconds input across the app; reading the
// value back is parseDuration's job in each field's own change handler.
@Directive({
  selector: 'input[durationMask]',
  standalone: true
})
export class DurationMaskDirective {
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const masked = maskDurationInput(input.value);
    if (masked !== input.value) {
      input.value = masked;
    }
    input.setSelectionRange(masked.length, masked.length);
  }
}
