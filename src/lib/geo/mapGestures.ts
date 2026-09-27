/**
 * A map inside a scrolling page: a plain two-finger swipe or mouse wheel
 * scrolls the page, as it does everywhere else; a pinch (which browsers send
 * as a wheel with ctrlKey) or Cmd/Ctrl + scroll still zooms the map. Touch
 * dragging is untouched. Returns a cleanup.
 */
export function letPageScroll(container: HTMLElement): () => void {
  const pass = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
  };
  // Capture on the container runs before the map's own wheel handler on its inner canvas box.
  container.addEventListener('wheel', pass, { capture: true });
  return () => container.removeEventListener('wheel', pass, { capture: true });
}
