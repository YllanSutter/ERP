# Plugin Steam - Documentation Complète

## Vue d'ensemble

Le plugin Steam ajoute deux fonctionnalités principales à votre ERP :

1. **Champ de recherche Steam** : Type de propriété custom avec autocomplete pour sélectionner des jeux
2. **Import de prix ITAD** : Récupère les prix depuis IsThereAnyDeal et les met à jour en masse

## Installation et Configuration

### 1. Charger la liste Steam

Le plugin a besoin d'une liste des jeux Steam pour l'autocomplete. Vous devez remplir `/public/steamList.json` avec le format suivant :

```json
[
  { "appid": 570, "name": "Dota 2" },
  { "appid": 730, "name": "Counter-Strike 2" },
  { "appid": 440, "name": "Team Fortress 2" },
  ...
]
```

**Où obtenir cette liste ?**
- Télécharger depuis [SteamAPI](https://api.steampowered.com/ISteamApps/GetAppList/v1/)
- Ou utiliser un dataset externe (Kaggle, etc.)

### 2. Configurer les variables d'environnement

Ajouter votre clé API ITAD au `.env` :

```bash
ITAD_API_KEY=your_api_key_here
```

Obtenir une clé : https://isthereanydeal.com/api/

### 3. Activer le plugin

1. Allez dans **Admin** → **Plugins**
2. Cliquez sur **Activer** pour le plugin Steam
3. Configurez les colonnes de prix (voir section Configuration)

## Utilisation

### Champ Steam (Autocomplete)

#### Créer un champ de type "steam"

1. Allez dans une collection
2. Ajoutez une nouvelle propriété
3. **Type** : Sélectionner **Steam** (disponible si le plugin est actif)
4. Nommez le champ (ex: "Jeu Steam")

#### Utiliser le champ

- Tapez le nom d'un jeu
- L'autocomplete affiche les 10 premiers résultats
- Cliquez sur un jeu pour le sélectionner
- La valeur s'affiche dans le champ

### Import ITAD

#### Configuration

Avant d'importer les prix, configurez les colonnes :

1. Allez dans **Admin** → **Plugins** → **Steam**
2. Cliquez sur le bouton ⚙️ de configuration
3. Remplissez :
   - **Colonne Prix Soldé** : où stocker les prix réduits
   - **Colonne Prix Régulier** : où stocker les prix normaux
   - **Colonne Marché Gris** (optionnel) : pour les boutiques gris
   - **Pays** : Code pays ISO (FR, EN, DE, etc.)
   - **Boutiques** : IDs ITAD (61 = Steam)
   - **Capacité** : Nombre de résultats par jeu

#### Importer les prix

1. Allez dans le tableau de votre collection
2. Sélectionnez les items à mettre à jour
3. Cliquez sur le bouton **"Importer depuis ITAD"**
4. Les prix sont récupérés et mis à jour automatiquement

#### Exemple de flux

```
Tableau avec jeux Steam
├── Sélectionner 10 jeux
├── Cliquer "Importer depuis ITAD"
├── Le plugin:
│   ├── 1. Cherche l'ID ITAD de chaque jeu (via appid Steam)
│   ├── 2. Récupère les prix actuels
│   ├── 3. Détecte le prix Steam (Shop ID 61)
│   ├── 4. Identifie les prix du marché gris
│   └── 5. Remplit les colonnes configurées
└── Les prix sont à jour ✅
```

## API et Endpoints

### GET `/api/plugins/steam/games`
Récupère la liste des jeux Steam disponibles.

```bash
curl http://localhost:4000/api/plugins/steam/games
```

### POST `/api/plugins/steam/import-prices`
Importe les prix depuis ITAD pour des items.

**Body :**
```json
{
  "itemIds": ["item-1", "item-2"],
  "organizationId": "org-123",
  "config": {
    "priceSaleColumn": "col-price-sale",
    "priceRegularColumn": "col-price-regular",
    "itadCountry": "FR",
    "itadShops": [61],
    "itadCapacity": 3
  }
}
```

**Response :**
```json
{
  "success": true,
  "updated": 2,
  "errors": 0,
  "details": {
    "updates": [
      {
        "itemId": "item-1",
        "steamAppId": 570,
        "itadId": "dota-2",
        "prices": { "sale": 0, "regular": 0 }
      }
    ],
    "errors": []
  }
}
```

## Architecture

### Structure des fichiers

```
src/lib/plugins/steam/
├── manifest.ts           # Métadonnées du plugin
├── index.ts              # Logique principale du plugin
├── steamUtils.ts         # Utilitaires (recherche, chargement)
└── ...

src/components/
├── fields/
│   └── SteamPropertyField.tsx    # Composant du champ autocomplete
└── admin/
    └── SteamPluginConfig.tsx     # Dialogue de configuration

server/
└── index.js              # Endpoint /api/plugins/steam/import-prices
```

### Flux de données

```
Utilisateur crée/édite item
    ↓
SteamPropertyField affiche autocomplete
    ↓
Sélectionne un jeu
    ↓
La valeur est sauvegardée dans l'item

---

Utilisateur sélectionne items + clique "Importer ITAD"
    ↓
POST /api/plugins/steam/import-prices
    ↓
Pour chaque item:
  1. Lookup ITAD ID via Steam App ID
  2. Récupère les prix v3
  3. Extrait les prix Steam + marché gris
  4. Remplit les colonnes configurées
    ↓
Réponse avec résumé
```

## Limitations et Notes

### Limites ITAD
- **Rate limiting** : 120ms de délai entre les requêtes (respecte les conditions d'usage ITAD)
- **Timeouts** : 10s pour lookup, 15s pour prices
- **Résultats** : Limité à la capacité configurée

### Données manquantes
Si un item n'a pas de Steam App ID, il sera skippé avec erreur:
```
{ "itemId": "...", "error": "No Steam App ID found" }
```

### Performance
Pour 100 items :
- ~2 minutes (avec délai rate limiting)
- Recommandé: Importer par batch de 10-20 items

## Dépannage

### "Aucun plugin disponible"
→ Vérifier que le plugin est bien enregistré dans `registry.ts`

### "ITAD_API_KEY not configured"
→ Ajouter `ITAD_API_KEY=...` dans le `.env` et relancer le serveur

### Les autocompletes ne s'affichent pas
→ Vérifier que `/public/steamList.json` existe et est valide

### Import échoue avec "ITAD ID not found"
→ Le jeu n'existe pas sur ITAD (sortie/suppression possible)

## Exemple complet : Ajouter un jeu à une collection

1. **Créer la collection "Jeux"**
   - Propriétés : Nom, Jeu Steam (type Steam), Prix Vente, Prix Achat

2. **Créer un item**
   - Nom: "Mon Jeu"
   - Jeu Steam: Taper "Dota" → Sélectionner "Dota 2"

3. **Importer les prix**
   - Sélectionner l'item
   - Cliquer "Importer depuis ITAD"
   - Les prix se remplissent automatiquement

## Support et Améliorations

Fonctionnalités possibles :
- [ ] Cache des prix (éviter re-requêtes inutiles)
- [ ] Scheduler d'import (mise à jour automatique)
- [ ] Historique des prix
- [ ] Graphiques de prix
- [ ] Comparaison multi-boutiques
