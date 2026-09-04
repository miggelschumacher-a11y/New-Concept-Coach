import { Directive, HostListener } from '@angular/core';

// Selects an edit field's entire content as soon as it's focused, so typing
// immediately replaces the old value instead of appending to it. Applied to
// every editable input across the app via the `selectOnFocus` attribute.
@Directive({
  selector: '[selectOnFocus]',
  standalone: true
})
export class SelectOnFocusDirective {
  @HostListener('focus', ['$event'])
  onFocus(event: Event): void {
    (event.target as HTMLInputElement).select();
  }
}
