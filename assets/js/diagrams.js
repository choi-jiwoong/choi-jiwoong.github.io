/* Render Jekyll/Rouge Mermaid fences only on pages that contain diagrams. */
(async function () {
  document.querySelectorAll('.post-content table').forEach((table) => {
    const scroll = document.createElement('div');
    scroll.className = 'post-table-scroll';
    if (table.rows[0]?.cells.length >= 4) scroll.classList.add('table-wide');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', '비교 표. 넓은 표는 가로로 스크롤할 수 있습니다.');
    table.before(scroll);
    scroll.appendChild(table);
  });
  const blocks = [...document.querySelectorAll('.post-content pre > code.language-mermaid, .post-content .language-mermaid pre > code')];
  if (!blocks.length) return;

  const diagrams = blocks.map((code, index) => {
    const source = code.textContent.trim();
    const wrapper = code.closest('div.highlighter-rouge') || code.closest('pre');
    const figure = document.createElement('figure');
    figure.className = 'post-diagram';
    const caption = document.createElement('figcaption');
    caption.textContent = `다이어그램 ${index + 1}`;
    const canvas = document.createElement('div');
    canvas.className = 'diagram-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'region');
    canvas.setAttribute('aria-label', `다이어그램 ${index + 1}. 넓은 그림은 가로로 스크롤할 수 있습니다.`);
    const details = document.createElement('details');
    details.className = 'diagram-source';
    const summary = document.createElement('summary');
    summary.textContent = '다이어그램 원문 보기';
    const pre = document.createElement('pre');
    pre.textContent = source;
    details.append(summary, pre);
    const status = document.createElement('p');
    status.className = 'diagram-status';
    status.textContent = '다이어그램을 불러오는 중입니다.';
    figure.append(caption, status, canvas, details);
    wrapper.replaceWith(figure);
    return { source, canvas, details, status, index };
  });

  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    await document.fonts.ready;
    const mermaid = window.mermaid;
    let renderedTheme;
    let running = false;
    let generation = 0;
    const currentTheme = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

    async function render() {
      if (running) return;
      running = true;
      try {
        do {
          const theme = currentTheme();
          const dark = theme === 'dark';
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
            theme: 'base',
            fontFamily: 'Inter, Pretendard, sans-serif',
            themeVariables: {
              darkMode: dark,
              background: dark ? '#11151a' : '#ffffff',
              primaryColor: dark ? '#253326' : '#edf5df',
              primaryTextColor: dark ? '#eef2f6' : '#182015',
              primaryBorderColor: dark ? '#89bd51' : '#6d8d45',
              secondaryColor: dark ? '#202e3b' : '#edf3fa',
              tertiaryColor: dark ? '#292630' : '#f4eff8',
              lineColor: dark ? '#a2b0bd' : '#596a58',
              textColor: dark ? '#eef2f6' : '#182015',
              mainBkg: dark ? '#253326' : '#edf5df',
              nodeBorder: dark ? '#89bd51' : '#6d8d45',
              clusterBkg: dark ? '#171c22' : '#f6f8f2',
              clusterBorder: dark ? '#465248' : '#cad5c0',
              edgeLabelBackground: dark ? '#171c22' : '#ffffff',
              actorBkg: dark ? '#253326' : '#edf5df',
              actorTextColor: dark ? '#eef2f6' : '#182015',
              actorBorder: dark ? '#89bd51' : '#6d8d45',
              actorLineColor: dark ? '#a2b0bd' : '#596a58',
              signalColor: dark ? '#eef2f6' : '#182015',
              signalTextColor: dark ? '#eef2f6' : '#182015',
              noteBkgColor: dark ? '#292630' : '#f4eff8',
              noteTextColor: dark ? '#eef2f6' : '#182015',
              noteBorderColor: dark ? '#8f83a4' : '#afa1c1',
              fontSize: '16px'
            },
            flowchart: { htmlLabels: false, curve: 'basis', nodeSpacing: 28, rankSpacing: 38, padding: 16, useMaxWidth: false },
            sequence: { useMaxWidth: false, wrap: true, actorMargin: 35, messageMargin: 30 }
          });
          for (const diagram of diagrams) {
            try {
              const { svg } = await mermaid.render(`post-diagram-${diagram.index}-${generation++}`, diagram.source);
              diagram.canvas.innerHTML = svg;
              const element = diagram.canvas.querySelector('svg');
              const width = element.viewBox.baseVal.width || 600;
              element.style.width = `${width}px`;
              element.style.maxWidth = 'none';
              element.style.height = 'auto';
              element.setAttribute('aria-label', `다이어그램 ${diagram.index + 1}`);
              diagram.status.hidden = true;
            } catch (error) {
              diagram.status.textContent = '그림을 표시하지 못했습니다. 아래 원문을 확인해 주세요.';
              diagram.status.hidden = false;
              diagram.details.open = true;
              console.error('Mermaid rendering failed', error);
            }
          }
          renderedTheme = theme;
        } while (renderedTheme !== currentTheme());
      } finally {
        running = false;
      }
    }
    const observer = new MutationObserver(() => {
      if (renderedTheme !== currentTheme()) render();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    await render();
  } catch (error) {
    for (const diagram of diagrams) {
      diagram.status.textContent = '다이어그램을 불러오지 못했습니다. 아래 원문을 확인해 주세요.';
      diagram.details.open = true;
    }
    console.error('Mermaid could not be loaded', error);
  }
})();
