/* Radar : logique de filtrage, partagée par l'appli (navigateur) et les tests (Node). */
(function (racine) {
  'use strict';

  var MOIS = {
    1: ['january', 'jan', 'janvier', 'janv'],
    2: ['february', 'feb', 'février', 'fevrier', 'févr', 'fevr'],
    3: ['march', 'mar', 'mars'],
    4: ['april', 'apr', 'avril', 'avr'],
    5: ['may', 'mai'],
    6: ['june', 'jun', 'juin'],
    7: ['july', 'jul', 'juillet', 'juil'],
    8: ['august', 'aug', 'août', 'aout'],
    9: ['september', 'sep', 'sept', 'septembre'],
    10: ['october', 'oct', 'octobre'],
    11: ['november', 'nov', 'novembre'],
    12: ['december', 'dec', 'décembre', 'decembre', 'déc']
  };

  var ENVIES = {
    soleil: ['cancun', 'cancún', 'punta cana', 'cuba', 'varadero', 'havana', 'la havane', 'cayo coco', 'holguin',
      'aruba', 'san juan', 'puerto rico', 'miami', 'fort lauderdale', 'orlando', 'tampa', 'montego bay', 'jamaica',
      'jamaïque', 'bahamas', 'nassau', 'puerto vallarta', 'los cabos', 'cabo', 'costa rica', 'liberia', 'san jose',
      'panama', 'dominican', 'dominicaine', 'santo domingo', 'puerto plata', 'samana', 'barbados', 'barbade',
      'saint lucia', 'sainte-lucie', 'guadeloupe', 'pointe-à-pitre', 'martinique', 'fort-de-france', 'hawaii',
      'honolulu', 'maui', 'cartagena', 'carthagène', 'curacao', 'curaçao', 'st. maarten', 'saint-martin',
      'turks', 'providenciales', 'cozumel', 'huatulco', 'ixtapa', 'mazatlan', 'belize', 'roatan', 'grenada'],
    europe: ['paris', 'lisbon', 'lisbonne', 'porto', 'madrid', 'barcelona', 'barcelone', 'rome', 'london',
      'londres', 'dublin', 'amsterdam', 'athens', 'athènes', 'brussels', 'bruxelles', 'nice', 'lyon', 'marseille',
      'bordeaux', 'toulouse', 'berlin', 'munich', 'frankfurt', 'francfort', 'vienna', 'vienne', 'prague',
      'reykjavik', 'milan', 'venice', 'venise', 'zurich', 'geneva', 'genève', 'copenhagen', 'copenhague',
      'stockholm', 'oslo', 'budapest', 'warsaw', 'varsovie', 'edinburgh', 'édimbourg', 'manchester', 'malaga',
      'faro', 'ponta delgada', 'azores', 'açores', 'naples', 'florence', 'krakow', 'cracovie', 'split', 'dubrovnik'],
    ville: ['new york', 'nyc', 'paris', 'london', 'londres', 'tokyo', 'chicago', 'los angeles', 'san francisco',
      'boston', 'washington', 'seoul', 'séoul', 'hong kong', 'singapore', 'singapour', 'bangkok', 'mexico city',
      'buenos aires', 'rome', 'berlin', 'barcelona', 'barcelone', 'madrid', 'istanbul', 'dubai', 'las vegas',
      'vancouver', 'toronto', 'sydney', 'amsterdam', 'lisbon', 'lisbonne']
  };

  var MOTS_ERREUR = ['error fare', 'mistake fare', 'erreur de prix', 'price glitch', 'glitch'];

  var DEV = 'CAD|USD|EUR|GBP|C\\$|CA\\$|US\\$|\\$|€|£';
  var RE_PRIX = new RegExp(
    '(?:(' + DEV + ')\\s?\\$?\\s?(\\d[\\d\\s,]{1,6})(CAD|USD|EUR|GBP)?)' +
    '|(?:(\\d[\\d\\s,]{1,6})\\s?(' + DEV + ')(?:\\s?(CAD|USD|EUR|GBP))?)', 'gi');
  var SYMBOLES = { 'c$': 'CAD', 'ca$': 'CAD', 'us$': 'USD', '€': 'EUR', '£': 'GBP' };
  var AFFICHAGE = { CAD: '$ CA', USD: '$ US', EUR: '€', GBP: '£' };

  // Taux de secours (1 unité = X $ CA), si Internet ne répond pas. Approximatifs.
  var TAUX_SECOURS_CAD = { CAD: 1, USD: 1.40, EUR: 1.62, GBP: 1.85 };

  function contientMot(texte, mot) {
    var m = mot.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-zà-ÿ])' + m + '($|[^a-zà-ÿ])').test(texte);
  }

  function Convertisseur(locale, taux, fraisPct) {
    this.locale = locale;
    this.taux = taux || {};
    this.frais = (fraisPct || 0) / 100;
  }
  Convertisseur.prototype.versLocale = function (montant, devise) {
    if (devise === this.locale) return montant;
    if (!this.taux[devise]) return null;
    return montant * this.taux[devise] * (1 + this.frais);
  };
  Convertisseur.prototype.nom = function (devise) { return AFFICHAGE[devise] || devise; };

  function trouverPrix(texte, conv, dollar) {
    var meilleur = null, m;
    RE_PRIX.lastIndex = 0;
    while ((m = RE_PRIX.exec(texte)) !== null) {
      var n = m[2] || m[4];
      var brut = m[3] || m[6] || m[1] || m[5];
      var valeur = parseInt(String(n).replace(/[\s,]/g, ''), 10);
      if (!(valeur >= 30 && valeur <= 20000)) continue;
      var b = brut.toLowerCase();
      var dev = b === '$' ? dollar : (SYMBOLES[b] || brut.toUpperCase());
      var loc = conv.versLocale(valeur, dev);
      var cle = loc === null ? Infinity : loc;
      if (!meilleur || cle < meilleur.local) meilleur = { montant: valeur, devise: dev, local: cle };
    }
    return meilleur;
  }

  /* Évalue une aubaine. Retourne null si écartée, sinon un objet enrichi. */
  function evaluer(a, crit, conv) {
    var texte = (a.titre + ' ' + (a.texte || '')).toLowerCase();
    var depart = (crit.departs || []).filter(function (d) { return contientMot(texte, d); })[0];
    if (!depart) return null;

    var notes = [];
    var mois = crit.mois || [];
    if (mois.length) {
      var bon = mois.some(function (mo) { return MOIS[mo].some(function (nom) { return contientMot(texte, nom); }); });
      if (!bon) {
        if (crit.exigerMois) return null;
        notes.push('dates à vérifier');
      }
    }

    var envies = crit.envies || [];
    if (envies.length && envies.indexOf('surprise') === -1) {
      var ok = envies.some(function (e) {
        return (ENVIES[e] || []).some(function (lieu) { return contientMot(texte, lieu); });
      });
      if (!ok) return null;
    }

    if ((crit.exclure || []).some(function (e) { return contientMot(texte, e); })) return null;

    var prix = trouverPrix(a.titre + ' ' + (a.texte || ''), conv, a.dollar || conv.locale);
    var local = prix && prix.local !== Infinity ? prix.local : null;
    if (crit.budget && local !== null && local > crit.budget) return null;
    if (!prix) notes.push('prix à vérifier');

    return {
      id: a.id, titre: a.titre, lien: a.lien, source: a.source, date: a.date,
      depart: depart, prix: prix, prixLocal: local, notes: notes,
      erreur: MOTS_ERREUR.some(function (mot) { return texte.indexOf(mot) !== -1; })
    };
  }

  function filtrer(aubaines, crit, conv) {
    var res = [];
    aubaines.forEach(function (a) { var e = evaluer(a, crit, conv); if (e) res.push(e); });
    res.sort(function (x, y) {
      if (x.erreur !== y.erreur) return x.erreur ? -1 : 1;
      return (x.prixLocal === null ? 1e9 : x.prixLocal) - (y.prixLocal === null ? 1e9 : y.prixLocal);
    });
    return res;
  }

  var api = {
    filtrer: filtrer, evaluer: evaluer, trouverPrix: trouverPrix, Convertisseur: Convertisseur,
    TAUX_SECOURS_CAD: TAUX_SECOURS_CAD, AFFICHAGE: AFFICHAGE, MOIS: MOIS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Radar = api;
})(this);
