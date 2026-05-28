import React, { useEffect } from 'react';
import { useRole } from '@/context/RoleContext';

/**
 * When the current user is a viewer, this component injects a global
 * MutationObserver that hides/disables write actions (buttons whose labels
 * suggest mutation, plus form inputs) across the app — without requiring
 * per-page edits. Elements inside `[data-viewer-allow]` containers are
 * left alone (use this around filters, search boxes, dialogs that are
 * read-only, etc.).
 */
const WRITE_KEYWORDS = [
  'create', 'add', 'new', 'edit', 'delete', 'remove', 'save', 'update',
  'upload', 'submit', 'set ', 'set stock', 'reset', 'approve', 'reject',
  'promote', 'demote', 'clone', 'duplicate', 'import', 'insert',
  'finalize', 'finalise', 'confirm', 'apply', 'reduce', 'reverse',
  'dispatch', 'generate', 'mark', 'pay', 'send', 'assign', 'unassign',
];

const SAFE_KEYWORDS = [
  'search', 'filter', 'clear', 'close', 'cancel', 'back', 'view',
  'open', 'expand', 'collapse', 'show', 'hide', 'select', 'pick',
  'export', 'download', 'print', 'share', 'logout', 'log out', 'sign out',
  'previous', 'next', 'page',
];

const matchAny = (text: string, list: string[]) =>
  list.some(k => text.includes(k));

const apply = (root: ParentNode) => {
  // Buttons
  root.querySelectorAll<HTMLElement>('button, [role="button"]').forEach(el => {
    if (el.dataset.viewerProcessed === '1') return;
    if (el.closest('[data-viewer-allow]')) return;
    // Skip sidebar nav buttons / sidebar trigger
    if (el.closest('[data-sidebar]')) return;
    if (el.closest('aside')) return;
    // Skip dropdown/select/popover/dialog triggers used for navigation/inspection
    const role = el.getAttribute('aria-haspopup') || el.getAttribute('data-state');
    const text = (el.textContent || '').trim().toLowerCase();
    if (!text && el.querySelector('svg')) return; // icon-only triggers (chevrons, etc.)
    if (matchAny(text, SAFE_KEYWORDS) && !matchAny(text, WRITE_KEYWORDS)) return;
    if (matchAny(text, WRITE_KEYWORDS)) {
      el.style.display = 'none';
      el.dataset.viewerProcessed = '1';
      return;
    }
    if (role) return;
  });

  // Form inputs — disable text/number/date inputs and textareas outside allow zones.
  root.querySelectorAll<HTMLElement>('input, textarea, select').forEach(el => {
    if (el.dataset.viewerProcessed === '1') return;
    if (el.closest('[data-viewer-allow]')) return;
    if (el.closest('[data-sidebar]')) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const t = (el as HTMLInputElement).type;
      if (['search', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(t)) return;
    }
    (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled = true;
    el.dataset.viewerProcessed = '1';
  });
};

export const ViewerGuard: React.FC = () => {
  const { isViewer, loading } = useRole();

  useEffect(() => {
    if (loading) return;
    document.body.classList.toggle('viewer-mode', isViewer);
    if (!isViewer) return;

    apply(document.body);
    const observer = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) apply(n as Element);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isViewer, loading]);

  return null;
};

export default ViewerGuard;
