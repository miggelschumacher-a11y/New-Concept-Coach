import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../pipes/translate.pipe';

// A small "..." tab on the bottom border of an input field that opens the same
// popup/dialog the field's long press does - for those who don't know about
// the long press, or find it awkward. Put it as a plain child of the
// mat-form-field (it lands in the field's infix, whose bottom edge is the
// outline's); it positions itself centred on that edge. It has no tooltip of
// its own: the field's tooltip already explains the long press, and two
// stacked tooltips would cover each other.
@Component({
  selector: 'app-field-more-button',
  standalone: true,
  imports: [MatIconModule, TranslatePipe],
  templateUrl: './field-more-button.component.html',
  styleUrl: './field-more-button.component.scss'
})
export class FieldMoreButtonComponent {
  @Output() readonly activated = new EventEmitter<void>();

  onClick(event: Event): void {
    // Not a click into the field itself: mat-form-field would otherwise focus
    // (and select) its input on any click inside its outline.
    event.stopPropagation();
    this.activated.emit();
  }
}
