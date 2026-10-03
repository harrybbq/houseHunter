import { useEffect, useRef, useState } from 'react';

export function HelpPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="help" ref={ref}>
      <button className="icon-btn round" aria-expanded={open} aria-label="Help" onClick={() => setOpen(!open)}>
        ?
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Tip">
          <h4>Watch the bay</h4>
          <p>
            Bay-fronted tenements often hide a small windowless kitchen off the lounge. Flats with a real dining kitchen
            that has a window more often have <em>no</em> bay. Check the floorplan, not just the description.
          </p>
          <p className="muted small">
            Keys 1–5 set the kitchen verdict while a listing is open. Esc closes it.
          </p>
        </div>
      )}
    </div>
  );
}
