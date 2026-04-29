# AI for Design

Plateforme prototype d'aide a la conception produit par intelligence artificielle.

Ce projet propose un espace de travail complet pour passer d'un brief produit a des concepts generes, les analyser avec des criteres DfX, comparer les variantes, puis preparer des livrables comme des rapports ou des exports techniques.

## Objectif De La Presentation

L'objectif de cette demonstration est de montrer une chaine de conception assistee par IA, depuis l'idee initiale jusqu'a l'evaluation technique.

Le projet repond a une question simple :

> Comment aider un designer, un ingenieur ou une equipe produit a generer, comparer et valider plus rapidement des concepts industriels ?

## Resume Du Projet

AI for Design est organise comme une application web moderne avec un backend API.

L'utilisateur peut :

- creer un projet produit ;
- renseigner un brief, des contraintes et des materiaux ;
- lancer un run de generation ;
- consulter des variantes de conception ;
- analyser les scores DfX ;
- suivre l'etat des runs ;
- preparer des rapports et exports ;
- utiliser des donnees mockees si les services IA ou Supabase ne sont pas configures.

## Ce Qui Est Deja Realise

### Interface Web

- Dashboard principal propre et lisible.
- Vue globale des projets, runs et etats.
- Page de creation de projet.
- Liste des projets avec indicateurs utiles.
- Navigation laterale orientee workflow produit.
- Branding nettoye autour de `AI for Design`.
- Application utilisable en local sans configuration lourde.

### Workflow Produit

- Creation de projets.
- Association de runs a un projet.
- Consultation des resultats.
- Pages dediees a la generation, aux resultats et au DfX.
- Donnees de demonstration disponibles quand l'API ou Supabase ne sont pas actifs.

### Backend API

Le backend FastAPI contient deja plusieurs briques :

- gestion des projets ;
- gestion des runs ;
- variantes de conception ;
- scoring multi-objectifs ;
- endpoints DfX ;
- generation de rapports ;
- exports ;
- diagnostics de sante ;
- integrations optionnelles avec Supabase, Redis, MLflow et diffusion.

### Qualite Technique

- Monorepo PNPM/Turborepo.
- Frontend Next.js 15.
- Backend FastAPI.
- TypeScript verifie.
- Build de production valide.
- Routes principales testees en smoke test.
- README nettoye pour la presentation.

## Architecture

```text
ai_for_design/
+-- apps/
|   +-- web/          Application Next.js
|   +-- api/          Backend FastAPI
|   +-- diffusion/    Prototype service IA image
|   +-- clip/         Prototype service CLIP
|   +-- streamlit/    Prototype alternatif
+-- packages/
|   +-- ui/           Composants UI partages
|   +-- supabase/     Clients et helpers Supabase
|   +-- features/     Authentification et comptes
|   +-- shared/       Utilitaires communs
+-- supabase/         Migrations et schema
+-- tooling/          Scripts et smoke tests
+-- scripts/          Scripts locaux et experimentations
```

## Stack Technique

| Couche | Technologie |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript |
| UI | Tailwind CSS, composants internes |
| Backend | FastAPI, Python |
| Monorepo | PNPM, Turborepo |
| Donnees | Supabase optionnel, fallback memoire |
| IA prototype | Diffusion, CLIP, scoring, DfX |
| Tests | TypeScript check, build Next.js, smoke tests |

## Parcours De Demonstration

Pour la presentation, le parcours conseille est :

1. Ouvrir le dashboard.
2. Montrer les indicateurs principaux : projets, runs, etat local de l'API.
3. Aller dans `Projects`.
4. Creer un nouveau projet produit.
5. Remplir un titre, une description, un type produit et un brief.
6. Ouvrir le projet cree.
7. Aller vers la generation.
8. Montrer la logique de run et de variantes.
9. Expliquer le role du DfX : fabricabilite, assemblage, durabilite, durabilite environnementale, score global.
10. Conclure sur les ameliorations possibles.

## Lancement Local

### 1. Installer les dependances

```bash
pnpm install
```

### 2. Lancer l'application web

```bash
pnpm --filter web dev
```

L'application se lance normalement sur :

```text
http://localhost:3000
```

Si le port `3000` est deja utilise, Next.js choisit automatiquement un autre port, par exemple :

```text
http://localhost:3001
```

### 3. Lancer le backend FastAPI

Dans un second terminal :

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API locale :

```text
http://127.0.0.1:8000
```

## Etat Actuel Verifie

Les validations suivantes ont ete effectuees :

```bash
pnpm --filter web typecheck
pnpm --filter web build
```

Resultat :

- TypeScript passe.
- Le build Next.js passe.
- Les pages principales repondent correctement :
  - `/dashboard`
  - `/projects`
  - `/projects/create`

## Ce Qui Fonctionne Bien

- Le projet est lancable en local.
- Le dashboard est clair pour une demonstration.
- Le workflow principal est comprehensible.
- L'application peut fonctionner meme sans Supabase grace aux donnees de fallback.
- Le backend contient deja beaucoup d'endpoints pour aller vers une plateforme complete.
- L'architecture permet de separer frontend, backend, IA, scoring et stockage.

## Limites Actuelles

Le projet est encore un prototype avance, pas encore un produit final.

Points a connaitre pendant la presentation :

- Certaines generations sont encore simulees ou basees sur des stubs.
- Les integrations IA completes ne sont pas toutes branchees en production.
- Supabase est optionnel en local, donc certaines donnees peuvent etre temporaires.
- Le lint global contient encore une dette technique historique, surtout dans les fichiers prototype.
- Certaines routes ADT et experimentation sont riches mais encore a stabiliser.
- Les exports CAD, FEM, topologie et diffusion peuvent etre ameliores avec de vrais services industriels.

## Ameliorations Possibles

### Court Terme

- Nettoyer completement le lint global.
- Uniformiser toute l'interface en francais ou en anglais.
- Ameliorer les pages de detail projet, resultats et DfX.
- Ajouter plus de feedback utilisateur pendant les generations.
- Ajouter des etats vides plus explicites.
- Renforcer les tests end-to-end sur le parcours principal.

### Moyen Terme

- Connecter Supabase comme source de donnees persistante par defaut.
- Ajouter une authentification stable avec roles utilisateur.
- Brancher un vrai service de generation d'image.
- Ajouter une file de jobs pour les generations longues.
- Ameliorer les rapports PDF.
- Ajouter un historique complet des decisions.
- Ajouter une comparaison visuelle des variantes.

### Long Terme

- Integrer de vrais solveurs CAD/FEM/topologie.
- Ajouter une boucle de feedback humain dans le scoring.
- Connecter PLM, ERP, MES ou outils industriels.
- Ajouter un systeme multi-tenant pour plusieurs equipes.
- Mettre en place monitoring, logs, metriques et alerting.
- Deployer frontend, API et services IA dans une infrastructure cloud.

## Proposition De Pitch Oral

Voici une version courte pour presenter le projet :

> AI for Design est une plateforme prototype qui aide a transformer un brief produit en concepts exploitables. L'utilisateur cree un projet, renseigne ses contraintes, lance des runs de generation, puis compare les variantes avec des criteres DfX. L'objectif est de reduire le temps entre l'ideation et la validation technique, tout en gardant une trace claire des decisions. Aujourd'hui, l'interface principale, le backend API, le workflow projet, les pages de generation et les bases du scoring sont en place. Les prochaines etapes consistent a brancher des services IA et industriels plus robustes, stabiliser la persistence, renforcer les tests et enrichir les exports techniques.

## Commandes Utiles

```bash
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web typecheck
pnpm --filter web lint
```

Backend :

```powershell
cd apps/api
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Smoke test API :

```powershell
pwsh -File tooling/scripts/smoke_api.ps1 -BaseUrl 'http://127.0.0.1:8000'
```

## Conclusion

AI for Design montre deja une base solide pour une plateforme de conception assistee par IA.

Le projet a aujourd'hui :

- une interface de demonstration propre ;
- une architecture evolutive ;
- un backend riche ;
- un workflow produit clair ;
- des fondations pour l'analyse DfX et la generation.

La suite naturelle est de transformer ce prototype en plateforme robuste en connectant les vrais services IA, les donnees persistantes, les solveurs techniques et les outils industriels.
