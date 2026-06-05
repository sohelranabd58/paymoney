// Responsive 468x60 banner ad wrapper.
// Loads the third-party script inside a sandboxed srcDoc iframe so it can't
// touch our DOM. The iframe is scaled with CSS transform on narrow viewports
// so the fixed 468x60 ad still fits cleanly on mobile.
import { useEffect, useRef, useState } from "react";

const SRC_DOC = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;overflow:hidden;}
body{display:flex;align-items:center;justify-content:center;}
</style></head><body>
<script type="text/javascript">
  atOptions = {
    'key' : '3ddb385849b6ae2086fe82c33434c492',
    'format' : 'iframe',
    'height' : 60,
    'width' : 468,
    'params' : {}
  };
</script>
<script type="text/javascript" src="https://www.highperformanceformat.com/3ddb385849b6ae2086fe82c33434c492/invoke.js"></script>
</body></html>`;

export function HighPerfBanner() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setScale(Math.min(1, w / 468));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className="mx-auto my-2 w-full max-w-[468px]"
      style={{ height: 60 * scale }}
      aria-label="Sponsored"
    >
      <iframe
        title="ad"
        srcDoc={SRC_DOC}
        sandbox="allow-scripts allow-same-origin allow-popups"
        scrolling="no"
        style={{
          width: 468,
          height: 60,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          display: "block",
        }}
      />
    </div>
  );
}
