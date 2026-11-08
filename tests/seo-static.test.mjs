// Verificación SEO estática. Sin paquetes ni servicios externos.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const origin = 'https://www.movidasst.com';
const publicPages = [
  { path: 'index.html', url: origin + '/' },
  { path: 'explorar.html', url: origin + '/explorar.html' },
  { path: 'seguridad.html', url: origin + '/seguridad.html' },
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
