import {useEffect} from 'react';

/**
 * Keeps a CSS variable on the root (`<html>`) at the element's height while it is mounted, and removes it after: what
 * covers the bottom of the window (a form's sticky action bar, a phone's selection bar) tells the root's scroll
 * padding, and the page's bottom room, how much it covers.
 */
export function useRootHeightVar(node: HTMLElement | null, name: string) {
  useEffect(() => {
    if (!node) return;
    const root = document.documentElement;
    const follow = () => root.style.setProperty(name, `${node.offsetHeight}px`);
    follow();
    const observer = new ResizeObserver(follow);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty(name);
    };
  }, [node, name]);
}
