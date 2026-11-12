# Radar – appli web d'aubaines de vols

Une appli qui s'installe sur l'écran d'accueil, comme GREENS, sans Python.

- **L'appli** (`index.html`, `filtre.js`) : tes critères restent sur ton téléphone. Elle filtre les aubaines, puis convertit les prix dans ta devise selon ta position.
- **Le robot** (`collecte/collecte.mjs` et `.github/workflows/collecte.yml`) : GitHub le lance gratuitement toutes les 2 heures. Il lit Secret Flying et The Flight Deal et met à jour `deals.json`.
- **L'hébergement** : GitHub Pages, gratuit.

## Mise en ligne (une seule fois)
1. Sur GitHub, crée un dépôt **public** nommé `radar`.
2. Mets-y tous les fichiers du dossier, y compris le dossier caché `.github`.
3. **Settings › Pages** : Source = *Deploy from a branch*, Branch = `main`, dossier `/ (root)`, puis **Save**.
4. **Settings › Actions › General** : en bas, choisis *Read and write permissions*, puis **Save**.
5. **Actions › Collecte des aubaines › Run workflow** : le robot fait son premier passage.
6. Après 1 ou 2 minutes, l'appli est à `https://<ton-nom>.github.io/radar/`.

## Installer sur iPhone
Ouvre l'adresse dans **Safari**, touche **Partager**, puis **Sur l'écran d'accueil**.

## Ajouter ou retirer une source
Modifie `sources.json`. Le champ `dollar` indique la devise à supposer quand une alerte écrit seulement « $ ».
