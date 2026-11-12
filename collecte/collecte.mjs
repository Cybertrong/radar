// Robot de collecte : lit les flux d'aubaines et écrit deals.json.
// Lancé toutes les 2 heures par GitHub Actions (.github/workflows/collecte.yml).
// Aucune dépendance : Node 18 ou plus.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, 'deals.json');
const GARDER_JOURS = 30;
const MAX_AUBAINES = 500;

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#8211': '–', '#8217': '’', '#8220': '“', '#8221': '”' };

function decoder(s) {
  return s.replace(/&(#?\w+);/g, (m, e) => ENTITES[e] ?? (/^#\d+$/.test(e) ? String.fromCodePoint(parseInt(e.slice(1), 10)) : m));
}

function nettoyer(s = '') {
  // Le HTML peut être échappé une fois (&lt;p&gt;) : on décode, on retire les balises, puis on décode le reste.
  return decoder(decoder(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).replace(/<[^>]+>/g, ' '))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function balise(bloc, nom) {
  const m = bloc.match(new RegExp(`<${nom}[^>]*>([\\s\\S]*?)</${nom}>`, 'i'));
  return m ? m[1] : '';
}

export function lireRss(xml, source) {
  const items = [];
  for (const bloc of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    const titre = nettoyer(balise(bloc, 'title'));
    const lien = nettoyer(balise(bloc, 'link'));
    const id = nettoyer(balise(bloc, 'guid')) || lien || titre;
    const date = Date.parse(nettoyer(balise(bloc, 'pubDate'))) || Date.now();
    if (!titre) continue;
    items.push({
      id: `${source.nom}|${id}`,
      titre,
      lien: /^https?:\/\//.test(lien) ? lien : '',
      texte: nettoyer(balise(bloc, 'description')).slice(0, 600),
      source: source.nom,
      dollar: source.dollar || 'CAD',
      date: new Date(date).toISOString()
    });
  }
  // Flux Atom (ex. YDeals)
  for (const bloc of xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []) {
    const titre = nettoyer(balise(bloc, 'title'));
    const lienM = bloc.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || bloc.match(/<link[^>]*href=["']([^"']+)["']/i);
    const lien = lienM ? lienM[1].replace(/&amp;/g, '&') : '';
    const id = nettoyer(balise(bloc, 'id')) || lien || titre;
    const date = Date.parse(nettoyer(balise(bloc, 'published') || balise(bloc, 'updated'))) || Date.now();
    if (!titre) continue;
    items.push({
      id: `${source.nom}|${id}`,
      titre,
      lien: /^https?:\/\//.test(lien) ? lien : '',
      texte: nettoyer(balise(bloc, 'summary') || balise(bloc, 'content')).slice(0, 600),
      source: source.nom,
      dollar: source.dollar || 'CAD',
      date: new Date(date).toISOString()
    });
  }
  return items;
}

async function lireSource(source) {
  if (/^https?:\/\//.test(source.url)) {
    const r = await fetch(source.url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; radar-perso/1.0; +https://cybertrong.github.io/radar/)', 'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }
  return readFile(path.join(RACINE, source.url), 'utf8');
}

async function main() {
  const sources = JSON.parse(await readFile(path.join(RACINE, 'sources.json'), 'utf8')).filter(s => s.actif !== false);
  let avant = { aubaines: [] };
  try { avant = JSON.parse(await readFile(SORTIE, 'utf8')); } catch { /* premier passage */ }

  const parId = new Map(avant.aubaines.map(a => [a.id, a]));
  const etat = [];
  for (const s of sources) {
    try {
      const xml = await lireSource(s);
      if (!/<(rss|feed|rdf:RDF)[\s>]/i.test(xml)) throw new Error('pas un flux RSS (site protégé ou adresse changée)');
      const items = lireRss(xml, s);
      for (const it of items) if (!parId.has(it.id)) parId.set(it.id, it);
      etat.push({ nom: s.nom, ok: true, nb: items.length });
    } catch (e) {
      console.error(`[!] ${s.nom} : ${e.message}`);
      etat.push({ nom: s.nom, ok: false, erreur: e.message });
    }
  }

  const limite = Date.now() - GARDER_JOURS * 864e5;
  const aubaines = [...parId.values()]
    .filter(a => Date.parse(a.date) >= limite)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, MAX_AUBAINES);

  await writeFile(SORTIE, JSON.stringify({ maj: new Date().toISOString(), sources: etat, aubaines }, null, 1));
  console.log(`${aubaines.length} aubaines enregistrées.`, etat.map(e => `${e.nom}: ${e.ok ? e.nb : 'échec'}`).join(' · '));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
