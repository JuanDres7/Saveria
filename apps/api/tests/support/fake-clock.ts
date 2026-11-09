import type { Clock } from '../../src/application/ports/services';

/** Reloj controlable para pruebas. */
export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-10-22T12:00:00.000Z')) {}

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = new Date(date);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
