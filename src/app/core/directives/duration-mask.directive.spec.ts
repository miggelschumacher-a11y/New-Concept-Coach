import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DurationMaskDirective } from './duration-mask.directive';

@Component({
  standalone: true,
  imports: [DurationMaskDirective],
  template: '<input type="text" durationMask />'
})
class HostComponent {}

describe('DurationMaskDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;
  let changeCount: number;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
    changeCount = 0;
    input.addEventListener('change', () => changeCount++);
  });

  const selection = () => [input.selectionStart, input.selectionEnd];

  function activate(value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('focus'));
    input.dispatchEvent(new Event('click'));
  }

  function tap(): void {
    // pointerdown while already focused is what marks a tap as a later one.
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => input });
    input.dispatchEvent(new Event('pointerdown'));
    input.dispatchEvent(new Event('click'));
    delete (document as { activeElement?: Element }).activeElement;
  }

  function type(text: string): void {
    for (const character of text) {
      input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: character, cancelable: true, bubbles: true }));
    }
  }

  function backspace(): void {
    input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', cancelable: true, bubbles: true }));
  }

  it('selects the hours on activation, then minutes and seconds on each further tap, then round again', () => {
    activate('1:01:08');
    expect(selection()).toEqual([0, 1]);
    tap();
    expect(selection()).toEqual([2, 4]);
    tap();
    expect(selection()).toEqual([5, 7]);
    tap();
    expect(selection()).toEqual([0, 1]);
  });

  it('types 1:01:08 as hours, a tap to the minutes, then minutes and seconds', () => {
    activate('0:00:00');
    type('1');
    tap();
    type('0108');
    expect(input.value).toBe('1:01:08');
  });

  it('completes a segment with a second digit and moves on to the next one', () => {
    activate('0:00:00');
    type('12');
    expect(input.value).toBe('12:00:00');
    expect(selection()).toEqual([3, 5]);
    type('34');
    expect(input.value).toBe('12:34:00');
    expect(selection()).toEqual([6, 8]);
  });

  it('completes a minute or second whose first digit cannot take a second one right away', () => {
    activate('0:00:00');
    tap();
    type('7');
    expect(input.value).toBe('0:07:00');
    expect(selection()).toEqual([5, 7]);
    type('9');
    expect(input.value).toBe('0:07:09');
    expect(selection()).toEqual([5, 7]);
  });

  it('keeps minutes and seconds within 59', () => {
    activate('0:00:00');
    tap();
    type('59');
    type('99');
    expect(input.value).toBe('0:59:09');
  });

  it('moves on with a colon or space typed', () => {
    activate('0:00:00');
    type('2:5 ');
    expect(input.value).toBe('2:05:00');
    expect(selection()).toEqual([5, 7]);
  });

  it('never lets a key remove or move a colon', () => {
    activate('1:01:08');
    tap();
    tap();
    backspace();
    expect(input.value).toBe('1:01:00');
    backspace();
    expect(input.value).toBe('1:01:00');
    expect(selection()).toEqual([2, 4]);
    backspace();
    backspace();
    backspace();
    expect(input.value).toBe('0:00:00');
    expect(input.value.split(':').length).toBe(3);
  });

  it('clears the whole field once every segment is zero', () => {
    activate('0:00:05');
    tap();
    tap();
    backspace();
    expect(input.value).toBe('0:00:00');
    backspace();
    expect(input.value).toBe('');
  });

  it('removes the last typed digit of a segment still awaiting its second one', () => {
    activate('0:00:00');
    tap();
    type('4');
    expect(input.value).toBe('0:04:00');
    backspace();
    expect(input.value).toBe('0:00:00');
  });

  it('shows zeros while an empty field is edited, and empties it again on blur if untouched', () => {
    activate('');
    expect(input.value).toBe('0:00:00');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('');
    expect(changeCount).toBe(0);
  });

  it('keeps what was typed into an empty field and reports the change on blur', () => {
    activate('');
    type('1');
    tap();
    type('30');
    input.dispatchEvent(new Event('blur'));
    expect(input.value).toBe('1:30:00');
    expect(changeCount).toBe(1);
  });

  it('reports no change for a field left as it was', () => {
    activate('0:01:00');
    input.dispatchEvent(new Event('blur'));
    expect(changeCount).toBe(0);
  });

  it('cancels the browser insertion so the value is only ever set by the mask', () => {
    activate('0:00:00');
    const event = new InputEvent('beforeinput', { inputType: 'insertText', data: 'a', cancelable: true, bubbles: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBeTrue();
    expect(input.value).toBe('0:00:00');
  });
});
