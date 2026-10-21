import { Injectable } from '@angular/core';

// The boundary every draggable popup (session options, rest timer, exercise
// timer) is kept within: an invisible box fixed to the whole viewport.
//
// cdkDragBoundary="body" was used for this before, but <body> is only as tall
// as the page content and moves with the scroll position - on a short page a
// popup couldn't be dragged lower than the content ends, and on a scrolled
// page not up into the part that had scrolled away. A fixed box covers exactly
// what is on screen, wherever the page is scrolled. (cdkDragBoundary takes a
// selector only for an ancestor, so the element itself is handed over.)
@Injectable({ providedIn: 'root' })
export class DragBoundaryService {
  private element: HTMLElement | null = null;

  get viewport(): HTMLElement {
    if (!this.element || !this.element.isConnected) {
      const element = document.createElement('div');
      element.setAttribute('aria-hidden', 'true');
      element.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:none;visibility:hidden;';
      document.body.appendChild(element);
      this.element = element;
    }
    return this.element;
  }
}
