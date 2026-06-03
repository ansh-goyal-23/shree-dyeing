import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRole } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';

/**
 * Applied when current user is an editor.
 *
 *  - On master-data routes: hides every write control (admin-only).
 *  - On other routes: hides edit/delete buttons inside [data-owner-id]
 *    containers whose id !== current user's id (so editors can only
 *    edit/delete records they themselves created). New/Add/Create
 *    buttons remain visible.
 *
 *  Containers with `[data-editor-allow]` are always left alone.
 */

const WRITE_KEYWORDS = [
  'create', 'add', 'new', 'edit', 'delete', 'remove', 'save', 'update',
  'upload', 'submit', 'set ', 'set stock', 'reset', 'approve', 'reject',
  'promote', 'demote', 'clone', 'duplicate', 'import', 'insert',
  'finalize', 'finalise', 'confirm', 'apply', 'reduce', 'reverse',
  'dispatch', 'generate', 'mark', 'pay', 'send', 'assign', 'unassign',
];

const EDIT_KEYWORDS = [
  'edit', 'delete', 'remove', 'update', 'save', 'reset',
  'approve', 'reject', 'promote', 'demote', 'clone', 'duplicate',
  'reduce', 'reverse', 'finalize', 'finalise', 'mark', 'unassign',
];

const SAFE_KEYWORDS = [
  'search', 'filter', 'clear', 'close', 'cancel', 'back', 'view',
  'open', 'expand', 'collapse', 'show', 'hide', 'select', 'pick',
  'export', 'download', 'print', 'share', 'logout', 'log out', 'sign out',
  'previous', 'next', 'page',
];

const WRITE_ICON_CLASSES = [
  'lucide-trash', 'lucide-trash-2', 'lucide-pencil', 'lucide-pen', 'lucide-edit',
  'lucide-plus', 'lucide-plus-circle', 'lucide-save', 'lucide-x', 'lucide-x-circle',
  'lucide-minus', 'lucide-upload', 'lucide-send',
];
const EDIT_ICON_CLASSES = [
  'lucide-trash', 'lucide-trash-2', 'lucide-pencil', 'lucide-pen', 'lucide-edit',
  'lucide-x', 'lucide-x-circle', 'lucide-minus',
];

const matchAny = (text: string, list: string[]) => list.some(k => text.includes(k));

const hasIcon = (el: HTMLElement, classes: string[]) => {
  const svgs = el.querySelectorAll('svg');
  for (const svg of Array.from(svgs)) {
    const cls = (svg.getAttribute('class') || '').toLowerCase();
    if (classes.some(c => cls.includes(c))) return true;
  }
  return false;
};

// Routes treated as "master data" — editors can view but NOT modify.
const MASTER_DATA_PATTERNS = [
  /^\/shade-management\/master(\/|$)/,
  /^\/dispatch\/client-rates(\/|$)/,
  /^\/item-master(\/|$)/,
  /^\/inventory\/opening-stock(\/|$)/,
  /^\/inventory\/bulk-opening-stock(\/|$)/,
];

const isMasterDataPath = (pathname: string) =>
  MASTER_DATA_PATTERNS.some(rx => rx.test(pathname));

// Hide write controls (same approach as ViewerGuard) — used for master data.
const hideAllWrites = (root: ParentNode) => {
  root.querySelectorAll<HTMLElement>('button, [role="button"]').forEach(el => {
    if (el.dataset.editorProcessed === '1') return;
    if (el.closest('[data-editor-allow]')) return;
    if (el.closest('[data-sidebar]')) return;
    if (el.closest('aside')) return;
    const text = (el.textContent || '').trim().toLowerCase();
    if (!text && hasIcon(el, WRITE_ICON_CLASSES)) {
      el.style.display = 'none';
      el.dataset.editorProcessed = '1';
      return;
    }
    if (!text && el.querySelector('svg')) return;
    if (matchAny(text, SAFE_KEYWORDS) && !matchAny(text, WRITE_KEYWORDS)) return;
    if (matchAny(text, WRITE_KEYWORDS) || hasIcon(el, WRITE_ICON_CLASSES)) {
      el.style.display = 'none';
      el.dataset.editorProcessed = '1';
    }
  });
  root.querySelectorAll<HTMLElement>('input, textarea, select').forEach(el => {
    if (el.dataset.editorProcessed === '1') return;
    if (el.closest('[data-editor-allow]')) return;
    if (el.closest('[data-sidebar]')) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const t = (el as HTMLInputElement).type;
      if (['search', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(t)) return;
    }
    (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled = true;
    el.dataset.editorProcessed = '1';
  });
};

// Hide edit/delete controls inside not-owned [data-owner-id] containers.
const hideForeignEdits = (root: ParentNode, userId: string) => {
  const containers = (root instanceof Element && root.matches('[data-owner-id]'))
    ? [root as HTMLElement, ...Array.from(root.querySelectorAll<HTMLElement>('[data-owner-id]'))]
    : Array.from(root.querySelectorAll<HTMLElement>('[data-owner-id]'));

  containers.forEach(container => {
    const owner = container.getAttribute('data-owner-id') || '';
    if (owner === userId) return; // owner can edit/delete
    container.querySelectorAll<HTMLElement>('button, [role="button"]').forEach(el => {
      if (el.dataset.editorOwnerProcessed === '1') return;
      if (el.closest('[data-editor-allow]')) return;
      const text = (el.textContent || '').trim().toLowerCase();
      const looksEdit = matchAny(text, EDIT_KEYWORDS) || (!text && hasIcon(el, EDIT_ICON_CLASSES));
      const looksSafe = !text || (matchAny(text, SAFE_KEYWORDS) && !matchAny(text, EDIT_KEYWORDS));
      if (looksEdit && !looksSafe) {
        el.style.display = 'none';
        el.dataset.editorOwnerProcessed = '1';
      } else if (!text && hasIcon(el, EDIT_ICON_CLASSES)) {
        el.style.display = 'none';
        el.dataset.editorOwnerProcessed = '1';
      }
    });
  });
};

export const EditorGuard: React.FC = () => {
  const { isEditor, loading } = useRole();
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    if (loading || !isEditor || !user) return;
    document.body.classList.add('editor-mode');

    const masterMode = isMasterDataPath(pathname);

    const run = (root: ParentNode) => {
      if (masterMode) hideAllWrites(root);
      else hideForeignEdits(root, user.id);
    };

    // Clear processed flags so re-route reruns logic cleanly
    document.querySelectorAll<HTMLElement>('[data-editor-processed], [data-editor-owner-processed]')
      .forEach(el => {
        el.removeAttribute('data-editor-processed');
        el.removeAttribute('data-editor-owner-processed');
        el.style.removeProperty('display');
      });

    run(document.body);
    const observer = new MutationObserver(muts => {
      for (const m of muts) {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) run(n as Element);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.body.classList.remove('editor-mode');
    };
  }, [isEditor, loading, user, pathname]);

  return null;
};

export default EditorGuard;
