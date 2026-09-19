import { Directive, ElementRef, HostListener } from '@angular/core';
import { formatDuration, maskDurationInput, parseDuration } from '../utils/duration-mask.util';

type Segment = 0 | 1 | 2;

// Turns a text input into an h:mm:ss field (see duration-mask.util for the
// value rules) edited one segment at a time, the way a native time input is:
//
// - Activating the field selects the hours; tapping it again selects the
//   minutes, once more the seconds, then round to the hours again.
// - Typing digits replaces the selected segment. A second digit completes it
//   and moves on to the next segment; minutes/seconds whose first digit
//   couldn't take a second one (6-9) complete right away. A colon or space
//   moves on too. Minutes and seconds never exceed 59, hours never 99.
// - The colons are fixed - no key can delete or move them.
// - Backspace empties the selected segment (or its last typed digit); once
//   every segment is zero it clears the whole field, which is how an optional
//   field (a rest override, a target) goes back to unset.
//
// Every edit is applied to the value directly (the browser's own insertion is
// cancelled in beforeinput), so a change event the browser would only send for
// its own edits is sent by hand on blur. Applied via the `durationMask`
// attribute to every seconds input across the app; reading the value back is
// parseDuration's job in each field's own change handler.
@Directive({
  selector: 'input[durationMask]',
  standalone: true
})
export class DurationMaskDirective {
  private segment: Segment = 0;
  // Digits typed into the active segment since it was selected - non-empty
  // means the next digit completes it instead of replacing it.
  private pending = '';
  private pointerStartedFocused = false;
  // What the last change event (native or ours) reported - blur only sends
  // one for a value that differs.
  private committedValue = '';
  private materializedEmptyField = false;
  private touched = false;

  constructor(private readonly host: ElementRef<HTMLInputElement>) {}

  private get input(): HTMLInputElement {
    return this.host.nativeElement;
  }

  @HostListener('focus')
  onFocus(): void {
    if (this.input.readOnly) {
      return;
    }
    this.committedValue = this.input.value;
    this.touched = false;
    // An empty (unset) field has no text to select a segment of - show zeros
    // for the duration of the edit, and put the emptiness back on blur if
    // nothing was typed.
    this.materializedEmptyField = this.input.value === '';
    if (this.materializedEmptyField) {
      this.input.value = formatDuration(0);
    }
    this.selectSegment(0);
  }

  // The pointer is down before the focus it causes, so this is the only place
  // to tell the tap that activates the field from a later one.
  @HostListener('pointerdown')
  onPointerDown(): void {
    this.pointerStartedFocused = document.activeElement === this.input;
  }

  // Runs after the browser has placed its own caret for the tap, which would
  // otherwise replace the selection.
  @HostListener('click')
  onClick(): void {
    if (this.input.readOnly) {
      return;
    }
    this.selectSegment(this.pointerStartedFocused ? (((this.segment + 1) % 3) as Segment) : 0);
    this.pointerStartedFocused = false;
  }

  @HostListener('blur')
  onBlur(): void {
    if (this.input.readOnly) {
      return;
    }
    if (this.materializedEmptyField && !this.touched && this.input.value === formatDuration(0)) {
      this.input.value = '';
    }
    if (this.input.value !== this.committedValue) {
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  @HostListener('change')
  onChange(): void {
    this.committedValue = this.input.value;
  }

  @HostListener('beforeinput', ['$event'])
  onBeforeInput(event: InputEvent): void {
    if (this.input.readOnly) {
      return;
    }
    if (event.inputType === 'insertText') {
      event.preventDefault();
      this.touched = true;
      for (const character of event.data ?? '') {
        this.typeCharacter(character);
      }
    } else if (event.inputType.startsWith('delete')) {
      event.preventDefault();
      this.touched = true;
      this.deleteInSegment();
    } else if (event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop') {
      event.preventDefault();
      this.touched = true;
      this.input.value = maskDurationInput(event.dataTransfer?.getData('text/plain') ?? event.data ?? '');
      this.selectSegment(0);
    }
  }

  // Safety net for input the browser applied itself despite the above (e.g. an
  // IME composition, which can't be cancelled): leaves the value well-formed.
  @HostListener('input')
  onInput(): void {
    const masked = maskDurationInput(this.input.value);
    if (masked !== this.input.value) {
      this.input.value = masked;
    }
    this.selectSegment(this.segment);
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.input.readOnly || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.selectSegment(Math.min(2, Math.max(0, this.segment + (event.key === 'ArrowRight' ? 1 : -1))) as Segment);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.touched = true;
      const parts = this.readParts();
      parts[this.segment] = Math.min(this.segmentMax(this.segment), Math.max(0, parts[this.segment] + (event.key === 'ArrowUp' ? 1 : -1)));
      this.writeParts(parts);
      this.selectSegment(this.segment);
    }
  }

  private typeCharacter(character: string): void {
    if (/\d/.test(character)) {
      this.typeDigit(Number(character));
    } else if (character === ':' || character === ' ' || character === '.' || character === ',') {
      this.moveToNextSegment();
    }
  }

  private typeDigit(digit: number): void {
    const segment = this.segment;
    const parts = this.readParts();
    let complete: boolean;
    if (this.pending === '') {
      parts[segment] = digit;
      // Hours can always take a second digit; minutes/seconds only up to 5x.
      complete = segment !== 0 && digit >= 6;
      this.pending = complete ? '' : String(digit);
    } else {
      parts[segment] = Number(this.pending + digit);
      complete = true;
      this.pending = '';
    }
    this.writeParts(parts);
    if (complete) {
      this.moveToNextSegment();
    } else {
      this.selectSegment(segment, true);
    }
  }

  private deleteInSegment(): void {
    const segment = this.segment;
    const parts = this.readParts();
    if (this.pending !== '') {
      this.pending = this.pending.slice(0, -1);
      parts[segment] = this.pending === '' ? 0 : Number(this.pending);
    } else if (parts[segment] !== 0) {
      parts[segment] = 0;
    } else if (parts.every((part) => part === 0)) {
      this.input.value = '';
      this.segment = 0;
      return;
    } else if (segment > 0) {
      this.selectSegment((segment - 1) as Segment);
      return;
    }
    this.writeParts(parts);
    this.selectSegment(segment, true);
  }

  private moveToNextSegment(): void {
    this.selectSegment(Math.min(2, this.segment + 1) as Segment);
  }

  private segmentMax(segment: Segment): number {
    return segment === 0 ? 99 : 59;
  }

  // An empty field counts as all zeros, so typing into it starts from 0:00:00.
  private readParts(): [number, number, number] {
    const total = parseDuration(this.input.value);
    const seconds = Number.isFinite(total) ? total : 0;
    return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
  }

  private writeParts(parts: [number, number, number]): void {
    this.input.value = formatDuration(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }

  // keepPending leaves a half-typed segment awaiting its second digit;
  // selecting a segment any other way starts it fresh.
  private selectSegment(segment: Segment, keepPending = false): void {
    this.segment = segment;
    if (!keepPending) {
      this.pending = '';
    }
    const value = this.input.value;
    const firstColon = value.indexOf(':');
    if (firstColon < 0) {
      return;
    }
    const start = [0, firstColon + 1, firstColon + 4][segment];
    const end = [firstColon, firstColon + 3, firstColon + 6][segment];
    this.input.setSelectionRange(start, end);
  }
}
