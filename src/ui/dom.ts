export function button(
  label: string,
  text: string,
  onClick: () => void,
  className?: string,
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  b.title = label;
  if (className) b.className = className;
  b.addEventListener('click', onClick);
  return b;
}

export function group(label: string, ...children: HTMLElement[]): HTMLDivElement {
  const g = document.createElement('div');
  g.className = 'group';
  g.setAttribute('role', 'group');
  g.setAttribute('aria-label', label);
  g.append(...children);
  return g;
}

export function field(
  panel: HTMLElement,
  label: string,
  type: string,
  attrs: Record<string, string> = {},
): HTMLInputElement {
  const l = document.createElement('label');
  l.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  Object.entries(attrs).forEach(([k, v]) => input.setAttribute(k, v));
  l.appendChild(input);
  panel.appendChild(l);
  return input;
}

/** Sets an input's value unless the user is currently editing it. */
export function setValue(el: HTMLInputElement, v: string): void {
  if (el !== document.activeElement) el.value = v;
}
