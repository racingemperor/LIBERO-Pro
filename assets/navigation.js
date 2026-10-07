// Reconcile a rendered view without discarding unchanged controls, media or scroll containers.
export function updateView(root, markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  syncChildren(root, template.content);
}

function syncChildren(current, next) {
  const oldChildren = [...current.childNodes];
  const newChildren = [...next.childNodes];
  for (let index = 0; index < Math.max(oldChildren.length, newChildren.length); index++) {
    const oldNode = oldChildren[index], newNode = newChildren[index];
    if (!oldNode) current.append(newNode.cloneNode(true));
    else if (!newNode) oldNode.remove();
    else syncNode(oldNode, newNode);
  }
}

function syncNode(current, next) {
  if (current.isEqualNode(next)) return;
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
    current.replaceWith(next.cloneNode(true));
    return;
  }
  if (current.nodeType !== Node.ELEMENT_NODE) {
    current.nodeValue = next.nodeValue;
    return;
  }
  // A different rollout must not keep playing the previous video's buffer.
  if (current.tagName === 'VIDEO') {
    current.pause();
    current.replaceWith(next.cloneNode(true));
    return;
  }
  for (const attribute of [...current.attributes]) {
    if (current.tagName === 'DETAILS' && attribute.name === 'open') continue;
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of next.attributes) {
    if (current.tagName === 'DETAILS' && attribute.name === 'open') continue;
    if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  syncChildren(current, next);
  if (current.tagName === 'SELECT') current.value = next.value;
}

export function isLocalViewLink(event, link, currentURL) {
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.hasAttribute('download') || (link.target && link.target !== '_self')) return false;
  const next = new URL(link.href, currentURL);
  const current = new URL(currentURL);
  return next.origin === current.origin && next.pathname === current.pathname;
}
