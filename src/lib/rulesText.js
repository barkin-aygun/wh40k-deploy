/**
 * Light formatter for rules text: escapes HTML first (defense in depth, even
 * though the source is a trusted build-time export), then converts the
 * **bold** markdown-lite the corpus uses into <strong> and newlines into <br>.
 */
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatRulesText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}
