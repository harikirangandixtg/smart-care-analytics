import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';

/**
 * Card grid that never leaves one card alone on the last row. It works out how many cards fit in a
 * row at the minimum width, then spreads them evenly over the rows needed
 * (6 cards → 6 · 3+3 · 2+2+2, never 5+1). Recalculates on resize and when cards are added or removed.
 */
@Directive({ selector: '[appBalancedGrid]', host: { '[style.grid-template-columns]': '"repeat(var(--cols, auto-fit), minmax(0, 1fr))"' } })
export class BalancedGridDirective implements AfterViewInit, OnDestroy {
  /** Smallest card width, px. */
  readonly minCard = input(170, { alias: 'appBalancedGrid', transform: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 170) });
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private ro?: ResizeObserver;
  private mo?: MutationObserver;

  ngAfterViewInit(): void {
    const update = () => {
      const n = [...this.el.children].filter(c => (c as HTMLElement).offsetParent !== null || getComputedStyle(c).display !== 'none').length;
      if (!n) return;
      const gap = parseFloat(getComputedStyle(this.el).columnGap) || 16;
      const perRow = Math.max(1, Math.floor((this.el.clientWidth + gap) / (this.minCard() + gap)));
      const rows = Math.ceil(n / perRow);
      this.el.style.setProperty('--cols', String(Math.ceil(n / rows)));
    };
    this.ro = new ResizeObserver(update);
    this.ro.observe(this.el);
    this.mo = new MutationObserver(update);
    this.mo.observe(this.el, { childList: true });
    update();
  }

  ngOnDestroy(): void { this.ro?.disconnect(); this.mo?.disconnect(); }
}
