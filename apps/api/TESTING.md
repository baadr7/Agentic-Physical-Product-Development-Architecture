## Tests et exécution (Windows PowerShell)

Ce document explique comment exécuter les tests pour l'API (`apps/api`) en local
et donne des commandes PowerShell prêtes à l'emploi.

Raisons d'utiliser les deux modes:
- **Isolé (recommandé pour CI / tests problématiques)** : chaque fichier de test s'exécute
  dans un processus Python séparé pour éviter la pollution d'état entre tests.
- **En-process (rapide)** : exécute la suite pytest normalement; utile pour développement rapide
  lorsque les tests sont bien isolés.

Prérequis
- Python venv installé dans `apps/api/.venv`
- Avoir installé les dépendances (`pip install -r apps/api/requirements.txt` si présent)

Activation du venv (PowerShell)
```powershell
& '.\apps\api\.venv\Scripts\Activate.ps1'
```

Exécuter la suite complète (mode in-process)
```powershell
Set-Location -Path 'c:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite'
$env:PYTHONPATH = "${PWD};${PWD}\apps\api"
& '.\apps\api\.venv\Scripts\python.exe' -m pytest -q
```

Exécuter la suite en mode isolé (par fichier) — recommandé si vous voyez des
échecs dépendants de l'ordre ou des variables d'environnement modifiées à l'import
:
```powershell
Set-Location -Path 'c:\Users\MSI\Documents\Makerkit\nextjs-saas-starter-kit-lite'
& '.\apps\api\.venv\Scripts\python.exe' '.\apps\api\scripts\run_tests_isolated.py'
```

Variables d'environnement utiles
- `LOAD_DOTENV=0` : désactive le chargement automatique de fichiers `.env` à l'import (tests isolés)
- `SUPABASE_STRICT=1` : force la plateforme à considérer Supabase comme configuré même
  si des services fallback sont présents (utile pour tests de `strict`)
- `JWT_REQUIRED=0|1` : contrôle l'exigence de JWT dans l'API lors des tests
- `PYTEST_CURRENT_TEST` : si présent, le code de test utilise cette valeur pour
  namespacer certains caches (ex: rate-limiter)

Dépannage rapide
- Si vous rencontrez des 401/403 inattendus : contrôler `JWT_REQUIRED` et `SUPABASE_JWT_SECRET`.
- Si vous rencontrez des échecs intermittents liés à l'état global : exécutez
  le runner isolé ci-dessus.

Contact
- Pour questions, ouvrir une issue ou m'envoyer un message dans le canal de projet.
