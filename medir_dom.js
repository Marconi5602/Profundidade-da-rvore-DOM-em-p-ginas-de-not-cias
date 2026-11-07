// Coleta de métricas da árvore DOM (profundidade, nós, filhos) com Playwright.
// Uso: npm i playwright && npx playwright install chromium
//      node medir_dom.js urls.csv resultados.csv
// urls.csv: portal,tipo,url   (tipo = inicial | materia)
const { chromium, devices } = require('playwright');
const fs = require('fs');

const REPETICOES = 3;
const ESPERA_MS = 2000;
const PERFIS = {
  desktop: { viewport: { width: 1366, height: 768 } },
  movel: devices['Pixel 5'],
};

// Executada dentro da página. html = nível 1; apenas elementos; sem iframes/shadow roots.
function medir() {
  let max = 0, total = 0, maxFilhos = 0, somaFolhas = 0, folhas = 0;
  const pilha = [[document.documentElement, 1]];
  while (pilha.length) {
    const [el, d] = pilha.pop();
    total++;
    if (d > max) max = d;
    const n = el.children.length;
    if (n > maxFilhos) maxFilhos = n;
    if (n === 0) { somaFolhas += d; folhas++; }
    for (const c of el.children) pilha.push([c, d + 1]);
  }
  return { profMax: max, total, maxFilhos, profMediaFolhas: folhas ? somaFolhas / folhas : 0 };
}

async function rolar(page) {
  await page.evaluate(async () => {
    await new Promise((ok) => {
      let y = 0;
      const t = setInterval(() => {
        window.scrollBy(0, 400); y += 400;
        if (y >= document.documentElement.scrollHeight + 400) { clearInterval(t); ok(); }
      }, 150);
      setTimeout(() => { clearInterval(t); ok(); }, 60000); // trava de segurança
    });
  });
}

const mediana = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

(async () => {
  const [, , entrada = 'urls.csv', saida = 'resultados.csv'] = process.argv;
  const linhas = fs.readFileSync(entrada, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('portal,'));
  const browser = await chromium.launch();
  const out = ['portal,tipo,url,perfil,fase,profMax,total,maxFilhos,profMediaFolhas,repeticoes_ok'];

  for (const linha of linhas) {
    const [portal, tipo, url] = linha.split(',');
    for (const [perfil, cfg] of Object.entries(PERFIS)) {
      const amostras = { carga: [], rolagem: [] };
      for (let r = 0; r < REPETICOES; r++) {
        const ctx = await browser.newContext(cfg);
        const page = await ctx.newPage();
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 45000 });
          await page.waitForTimeout(ESPERA_MS);
          amostras.carga.push(await page.evaluate(medir));
          await rolar(page);
          await page.waitForTimeout(ESPERA_MS);
          amostras.rolagem.push(await page.evaluate(medir));
        } catch (e) {
          console.error(`falha ${url} [${perfil}] rep ${r + 1}: ${e.message}`);
        }
        await ctx.close();
      }
      for (const fase of ['carga', 'rolagem']) {
        const a = amostras[fase];
        if (!a.length) continue;
        const m = (k) => mediana(a.map((x) => x[k]));
        out.push([portal, tipo, url, perfil, fase, m('profMax'), m('total'), m('maxFilhos'), m('profMediaFolhas').toFixed(2), a.length].join(','));
      }
      console.log(`ok: ${portal} ${tipo} ${perfil}`);
    }
  }
  fs.writeFileSync(saida, out.join('\n') + '\n');
  await browser.close();
})();
