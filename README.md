# Constellation

Constellation est un bureau visuel Windows, local-first, pour organiser et surveiller tous ses dépôts GitHub. Les dossiers, statuts, notes et caches restent chiffrés sur le PC avec Windows DPAPI.

## Fonctionnalités

- connexion GitHub par Device Authorization Flow ;
- dépôts personnels, privés et d’organisations ;
- plusieurs comptes GitHub mémorisés avec bascule rapide et données isolées ;
- bibliothèque avec dossiers et glisser-déposer ;
- Kanban Idée / Actif / Pause / Terminé / Archivé ;
- recherche, filtres, favoris et notes ;
- tableau de santé et détails GitHub ;
- cache hors connexion chiffré ;
- consultation intégrée du code, des issues, pull requests et workflows ;
- ouverture des dépôts GitHub depuis l’application ;
- archivage avec confirmation ;
- synchronisation automatique de l’organisation entre les appareils ;
- mises à jour automatiques avec téléchargement en arrière-plan ;
- sauvegardes portables AES-256-GCM protégées par mot de passe.

## Configuration OAuth GitHub

1. Dans GitHub, ouvrir **Settings → Developer settings → OAuth Apps → New OAuth App**.
2. Utiliser une URL d’accueil, par exemple `https://github.com/MiNel0/constellation`.
3. Activer **Device Flow** dans les paramètres de l’OAuth App.
4. Copier le Client ID et le définir avant de lancer ou construire :

```powershell
$env:CONSTELLATION_GITHUB_CLIENT_ID="Ov23li..."
npm run dev
```

Constellation demande `repo` et `read:org`. Le scope `repo` est large car GitHub OAuth ne fournit pas de permission plus fine pour ce parcours. L’application n’expose volontairement ni suppression, ni transfert, ni changement de visibilité.

## Développement et distribution

```powershell
npm install
npm run dev
npm run check
npm run build
```

Les exécutables NSIS par utilisateur et portable sont générés dans `release/`. Aucun droit administrateur n’est requis. Sans certificat de signature, Windows SmartScreen peut afficher un avertissement.

## Données et confidentialité

Les fichiers `settings.enc`, `workspace.enc`, `github-cache.enc` et `credentials.enc` sont stockés dans le dossier applicatif Windows et chiffrés avec DPAPI. Le token n’est jamais envoyé au renderer. Les sauvegardes n’incluent jamais les identifiants GitHub. Pour révoquer l’accès, supprimer l’autorisation de Constellation dans les paramètres GitHub.

## Limites V1

Plusieurs comptes GitHub peuvent être mémorisés, avec un seul profil actif à la fois. Constellation reste local-first et utilise un dépôt GitHub privé appartenant à chaque utilisateur pour synchroniser automatiquement son organisation entre ses appareils.
