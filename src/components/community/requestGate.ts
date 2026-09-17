/** Discard async results after a new selection, newer request, or unmount. */
export class RequestGate {
  private revision = 0;
  begin(): () => boolean {
    const revision = ++this.revision;
    return () => revision === this.revision;
  }
  invalidate(): void {
    this.revision++;
  }
}
