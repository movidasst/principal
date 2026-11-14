// Verificación SEO estática. Sin paquetes ni servicios externos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const origin = 'https://www.movidasst.com';
const publicPages = [
  { path: 'index.html', url: origin + '/' },
  { path: 'explorar.html', url: origin + '/explorar.html' },
  { path: 'seguridad.html', url: origin + '/seguridad.html' },
  { path: 'biblioteca/index.html', url: origin + '/biblioteca/' },
  { path: 'biblioteca/lopcymat/index.html', url: origin + '/biblioteca/lopcymat/' },
  { path: 'biblioteca/nt-04-2023/index.html', url: origin + '/biblioteca/nt-04-2023/' },
  { path: 'biblioteca/normas-covenin/index.html', url: origin + '/biblioteca/normas-covenin/' },
  { path: 'biblioteca/reglamentos-tecnicos/index.html', url: origin + '/biblioteca/reglamentos-tecnicos/' },
  { path: 'biblioteca/reglamentos-tecnicos/calzado-seguridad/index.html', url: origin + '/biblioteca/reglamentos-tecnicos/calzado-seguridad/' },
  { path: 'tv/index.html', url: origin + '/tv/' },
  { path: 'tv/catalogo/index.html', url: origin + '/tv/catalogo/' },
  { path: 'tv/destacados/index.html', url: origin + '/tv/destacados/' },
];
const technicalPages = [
  'diagnostico-ga4.html', 'offline.html', 'mi-movida/index.html',
];

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/g)) {
    result[match[1].toLowerCase()] = match[3];
  }
  return result;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))]
    .map((match) => attributes(match[0]));
}

function meta(html, name) {
  return tags(html, 'meta').filter((tag) => tag.name === name);
}

function canonical(html) {
  return tags(html, 'link').filter((tag) => tag.rel === 'canonical');
}

function sitemapEntries(xml) {
  return [...xml.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/g)].map((match) => {
    const loc = match[1].match(/<loc>([^<]+)<\/loc>/)?.[1];
    const lastmod = match[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    assert.ok(loc, 'Cada entrada del sitemap debe tener <loc>');
    if (lastmod) assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/);
    return { loc, lastmod };
  });
}

test('El sitemap declara exclusivamente las páginas públicas canónicas', () => {
  const xml = read('sitemap.xml');
  assert.match(xml, /<urlset\s+xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const entries = sitemapEntries(xml);
  assert.equal(entries.length, publicPages.length);
  const found = entries.map((entry) => entry.loc);
  assert.equal(new Set(found).size, found.length, 'No duplicar URLs');
  assert.deepEqual(found.sort(), publicPages.map((page) => page.url).sort());
  assert.doesNotMatch(xml, /<priority>|<changefreq>/i,
    'Google ignora priority y changefreq');
});

test('robots.txt permite rastrear e informa el sitemap canónico', () => {
  const robots = read('robots.txt');
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /^Allow:\s*\/\s*$/mi);
  assert.match(robots, /^Sitemap:\s*https:\/\/www\.movidasst\.com\/sitemap\.xml\s*$/mi);
  assert.doesNotMatch(robots, /^Disallow:\s*\/\s*$/mi);
});

test('Cada página pública tiene título, descripción, h1 y canonical únicos', () => {
  const titles = new Set();
  for (const page of publicPages) {
    const html = read(page.path);
    assert.match(html, /<html\b[^>]*\blang="es(?:-[A-Za-z]+)?"/i, page.path);
    const title = html.match(/<title>([^<]+)<\/title>/gi) || [];
    assert.equal(title.length, 1, page.path + ': título único');
    assert.ok(title[0].length >= 25, page.path + ': título descriptivo');
    assert.ok(!titles.has(title[0]), page.path + ': título no repetido');
    titles.add(title[0]);
    assert.match(html, /<h1\b[^>]*>/i, page.path + ': debe tener h1');
    const descriptions = meta(html, 'description');
    assert.equal(descriptions.length, 1, page.path + ': meta description única');
    assert.ok(descriptions[0].content?.length >= 50, page.path + ': descripción útil');
    const canonicals = canonical(html);
    assert.equal(canonicals.length, 1, page.path + ': una canonical');
    assert.equal(canonicals[0].href, page.url, page.path + ': canonical correcta');
    const robots = meta(html, 'robots');
    assert.ok(robots.every((item) => !/noindex/i.test(item.content || '')),
      page.path + ': no debe marcarse noindex');
  }
});

test('Páginas privadas/técnicas no aparecen indexadas ni en el sitemap', () => {
  const urls = sitemapEntries(read('sitemap.xml')).map((entry) => entry.loc);
  for (const path of technicalPages) {
    const html = read(path);
    assert.ok(meta(html, 'robots').some((item) => /(?:^|,)noindex(?:,|$)/i.test(item.content || '')),
      path + ': falta noindex');
    assert.ok(!urls.some((url) => url.endsWith('/' + path) || url.endsWith('/' + path.replace(/index\.html$/, ''))),
      path + ': no debe figurar en sitemap');
  }
});

test('Los datos estructurados de la portada son JSON-LD válido', () => {
  const html = read('index.html');
  const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, 'Falta JSON-LD');
  const graphs = scripts.map((match) => JSON.parse(match[1]))
    .flatMap((json) => json['@graph'] || [json]);
  assert.ok(graphs.some((node) => node['@type'] === 'Organization'));
  assert.ok(graphs.some((node) => node['@type'] === 'WebSite'));
  assert.ok(graphs.some((node) => node['@type'] === 'WebPage'
    && node.url === origin + '/'));
  const modified = graphs.find((node) => node['@type'] === 'WebPage')?.dateModified;
  const home = sitemapEntries(read('sitemap.xml')).find((entry) => entry.loc === origin + '/');
  assert.equal(modified, home.lastmod, 'Fecha de portada coherente con sitemap');
});


test('Biblioteca SST: artículos públicos, CTAs opcionales y JSON-LD válido', () => {
  const library = publicPages.filter((page) => page.path.startsWith('biblioteca/'));
  assert.equal(library.length, 6);
  for (const page of library) {
    const html = read(page.path);
    const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json"\s*>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 1, page.path + ': JSON-LD único');
    const document = JSON.parse(scripts[0][1]);
    const graph = document['@graph'] ?? [];
    assert.ok(graph.some((node) => node['@type'] === 'BreadcrumbList'));
    const entry = graph.find((node) => node['@type'] === 'Article' || node['@type'] === 'CollectionPage');
    assert.ok(entry, page.path + ': debe declarar Article o CollectionPage');
    assert.equal(entry.url, page.url, page.path + ': url estructurada');
    assert.equal(entry.isAccessibleForFree, true, page.path + ': acceso gratuito');
    assert.ok(!/noindex/i.test(html.match(/<meta name="robots" content="([^"]+)"/i)?.[1] ?? ''), page.path + ': indexable');
    assert.ok(!/Contraseña necesaria para leer|Regístrate para leer|Ingresa para leer/i.test(html), page.path + ': sin paywall');
    assert.match(html, /<link rel="stylesheet" href="\/biblioteca\/biblioteca\.css">/);
    assert.match(html, /href="\/"/, page.path + ': enlace a inicio');
  }
  for (const page of library.filter((page) => page.path !== 'biblioteca/index.html')) {
    const html = read(page.path);
    assert.match(html, /href="https:\/\/registro\.movidasst\.com\/"[^>]*>Registrarme gratis<\/a>/);
    assert.match(html, /href="https:\/\/whatsapp\.com\/channel\/0029Va0mlH5Jf05mrcCz8r3e"[^>]*>Canal oficial de WhatsApp<\/a>/);
    assert.match(html, /href="\/"[^>]*>Volver a la página principal<\/a>/);
    assert.equal((html.match(/<div class="actions biblioteca-actions"/g) || []).length, 1,
      page.path + ': debe tener un único bloque de accesos, al inicio de la guía');
    const topActions = html.match(/<div class="actions biblioteca-actions"[^>]*>[\s\S]*?<\/div>/)?.[0];
    assert.ok(topActions, page.path + ': falta bloque superior');
    for (const label of ['Registrarme gratis', 'Canal oficial de WhatsApp', 'Drive de La Movida', 'Volver a la página principal']) {
      const exact = topActions.split('>' + label + '</a>').length - 1;
      assert.equal(exact, 1, page.path + ': acceso duplicado ' + label);
    }
  }
});

test('La portada y Explorar enlazan a la biblioteca pública', () => {
  assert.match(read('index.html'), /href="\/biblioteca\/"/);
  assert.match(read('explorar.html'), /href="\/biblioteca\/"/);
});

test('Los enlaces internos absolutos de la biblioteca resuelven a archivos del repositorio', () => {
  for (const page of publicPages.filter((page) => page.path.startsWith('biblioteca/'))) {
    const html = read(page.path);
    for (const match of html.matchAll(/\bhref="(\/biblioteca\/[^"#?]*\/)"/g)) {
      const pathname = match[1].replace(/^\/+/, '');
      assert.ok(existsSync(resolve(root, pathname, 'index.html')), page.path + ': falta ' + match[1]);
    }
  }
});


test('Biblioteca SST enlaza al Drive colaborativo sin confundir acceso público con acceso de integrantes', () => {
  const biblioteca = publicPages.filter((page) => page.path.startsWith('biblioteca/'));
  assert.equal(biblioteca.length, 6);
  for (const page of biblioteca) {
    const html = read(page.path);
    assert.match(html, /href="https:\/\/drive\.movidasst\.com\/"[^>]*>/i, page.path + ': falta enlace a Drive');
    assert.match(html, /href="\/biblioteca\/"[^>]*>/i, page.path + ': falta retorno a Biblioteca');
    assert.match(html, /<meta name="robots" content="index,follow/i, page.path + ': guías indexables');
  }
  assert.match(read('biblioteca/index.html'), /Drive colaborativo conserva por ahora su acceso de integrantes/);
  assert.match(read('index.html'), /Drive de La Movida \(integrantes\)/);
});
