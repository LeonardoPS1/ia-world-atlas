export type Attrs = Record<string, string | number | boolean | null | undefined>;

function applyAttrs(node: Element, attrs?: Attrs): void {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'dataset') {
      for (const [dataKey, dataValue] of Object.entries(value as unknown as Record<string, string>)) {
        node.setAttribute(`data-${dataKey}`, dataValue);
      }
      continue;
    }
    if (key === 'text') {
      node.textContent = String(value);
      continue;
    }
    node.setAttribute(key, value === true ? '' : String(value));
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  for (const child of children) node.append(child);
  return node;
}

export function svgEl(tag: string, attrs?: Attrs, children: Node[] = []): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) node.append(child);
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function replaceChildren(node: Element, children: Node[]): void {
  clear(node);
  for (const child of children) node.append(child);
}