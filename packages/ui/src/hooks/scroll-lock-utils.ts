export function isScrollableOverflow(value: string): boolean {
  return value === "auto" || value === "scroll" || value === "overlay";
}

export function canScrollY(element: HTMLElement, deltaY: number): boolean {
  const { scrollTop, scrollHeight, clientHeight } = element;
  if (scrollHeight <= clientHeight) return false;
  if (deltaY < 0) return scrollTop > 0;
  if (deltaY > 0) return scrollTop + clientHeight < scrollHeight - 1;
  return false;
}

export function findScrollableAncestor(
  node: Node | null,
  boundary?: HTMLElement | null,
): HTMLElement | null {
  let current = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  while (current && (!boundary || boundary.contains(current))) {
    const style = window.getComputedStyle(current);
    if (isScrollableOverflow(style.overflowY) && current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function findOverlayScrollArea(node: Node | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const root = node.closest("[data-overlay-scroll]");
  if (!(root instanceof HTMLElement)) return null;
  return findScrollableAncestor(node, root) ?? root;
}
