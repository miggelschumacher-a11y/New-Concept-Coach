import { ComponentRef, Injectable, Injector } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, NavigationEnd, Router, RouteReuseStrategy } from '@angular/router';

const HISTORY_PATH = 'exercise-history/:id';
const HISTORY_URL_PREFIX = '/exercise-history/';

// Keeps the page the exercise history was opened from alive while the history
// is showing, instead of destroying it - so going back finds it exactly as it
// was left: every expanded accordion, active tab, filter, half-typed field and
// the scroll position, none of which a freshly created component could know.
//
// Deliberately narrow: only a navigation *into* the history detaches the page
// it leaves, only one page is ever held, and it's dropped again the moment the
// user goes anywhere but back to it (e.g. straight to another page via the
// toolbar). Every other navigation behaves as before - pages are re-created
// and reload their data - so nothing else can go stale behind the user's back.
@Injectable()
export class OriginPageReuseStrategy implements RouteReuseStrategy {
  private stored?: { path: string; handle: DetachedRouteHandle; scrollY: number };
  private scrollToRestore?: number;
  // Whether the last finished navigation ended on the history page - the
  // router's own url already points at the *next* page by the time
  // shouldAttach runs, so it can't tell what is being left.
  private onHistory = false;

  // The router is looked up lazily: it depends on the reuse strategy itself,
  // so injecting it in the constructor would be a circular dependency.
  constructor(private readonly injector: Injector) {}

  private get router(): Router {
    return this.injector.get(Router);
  }

  // Called once at startup (see app.config.ts), after the router exists.
  listenForNavigations(): void {
    this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) {
        return;
      }
      const onHistory = event.urlAfterRedirects.startsWith(HISTORY_URL_PREFIX);
      this.onHistory = onHistory;
      if (this.scrollToRestore !== undefined) {
        // The held page was just re-attached, so it lives on in the outlet.
        const scrollY = this.scrollToRestore;
        this.stored = undefined;
        this.scrollToRestore = undefined;
        // Once the re-attached page has laid out.
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      } else if (onHistory) {
        window.scrollTo(0, 0);
      } else {
        // The user left the history for somewhere else than the held page.
        this.discardStored();
      }
    });
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const path = route.routeConfig?.path;
    return !!path && path !== HISTORY_PATH && this.isNavigatingToHistory();
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const path = route.routeConfig?.path;
    if (!path || !handle) {
      return;
    }
    this.discardStored();
    this.stored = { path, handle, scrollY: window.scrollY };
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const path = route.routeConfig?.path;
    return !!path && this.stored?.path === path && this.onHistory;
  }

  // The router asks for the handle more than once while attaching it (and
  // asks shouldAttach again in between), so this must stay repeatable - the
  // held page is only let go of on NavigationEnd (see listenForNavigations).
  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    if (!this.stored || this.stored.path !== route.routeConfig?.path) {
      return null;
    }
    this.scrollToRestore = this.stored.scrollY;
    return this.stored.handle;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === current.routeConfig;
  }

  private isNavigatingToHistory(): boolean {
    const navigation = this.router.getCurrentNavigation();
    const target = navigation?.finalUrl ?? navigation?.extractedUrl;
    return !!target && this.router.serializeUrl(target).startsWith(HISTORY_URL_PREFIX);
  }

  // A detached handle's component is otherwise never destroyed by the router.
  private discardStored(): void {
    const handle = this.stored?.handle as { componentRef?: ComponentRef<unknown> } | undefined;
    handle?.componentRef?.destroy();
    this.stored = undefined;
  }
}
