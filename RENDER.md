# 🚀 Déploiement sur Render.com

Ce guide vous explique comment déployer n8n-MCP sur [Render.com](https://render.com), une plateforme cloud moderne et simple pour héberger vos applications.

## 📋 Prérequis

- Un compte [Render.com](https://render.com) (gratuit pour commencer)
- Un repository GitHub avec le code n8n-MCP
- [Render CLI](https://render.com/docs/cli) (optionnel, mais recommandé)

## 🎯 Déploiement rapide

### Option 1 : Déploiement automatique avec le script

```bash
# Cloner le repository
git clone https://github.com/adedara1/render-n8n-mcp.git
cd render-n8n-mcp

# Lancer le script de déploiement
./deploy/deploy-render.sh
```

### Option 2 : Déploiement manuel via l'interface web

1. **Connectez votre repository**
   - Allez sur [Render Dashboard](https://dashboard.render.com)
   - Cliquez sur "New +" → "Web Service"
   - Connectez votre repository GitHub

2. **Configurez le service**
   - **Name**: `n8n-mcp-server`
   - **Region**: Choisissez la région la plus proche
   - **Branch**: `main` ou `genspark_ai_developer`
   - **Runtime**: `Docker`
   - **Dockerfile Path**: `./Dockerfile.render`

3. **Variables d'environnement**
   ```
   NODE_ENV=production
   MCP_MODE=http
   USE_FIXED_HTTP=true
   IS_DOCKER=true
   LOG_LEVEL=info
   HOST=0.0.0.0
   CORS_ORIGIN=*
   AUTH_TOKEN=VotreTokenSecuriseDe32CaracteresMinimum
   ```

4. **Cliquez sur "Deploy Web Service"**

### Option 3 : Déploiement avec render.yaml

Le projet inclut un fichier `render.yaml` prêt à l'emploi :

```bash
# Installer Render CLI
npm install -g @render-cli/render

# Se connecter
render auth login

# Déployer
render services create --config render.yaml
```

## ⚙️ Configuration

### Variables d'environnement essentielles

| Variable | Description | Valeur par défaut |
|----------|------------|-------------------|
| `AUTH_TOKEN` | Token d'authentification (32+ caractères) | À définir |
| `MCP_MODE` | Mode de fonctionnement | `http` |
| `USE_FIXED_HTTP` | Utiliser le serveur HTTP fixe | `true` |
| `LOG_LEVEL` | Niveau de journalisation | `info` |
| `CORS_ORIGIN` | Origines CORS autorisées | `*` |
| `PORT` | Port d'écoute | `10000` (auto par Render) |

### Variables optionnelles pour l'intégration n8n

| Variable | Description |
|----------|------------|
| `N8N_API_URL` | URL de votre instance n8n |
| `N8N_API_KEY` | Clé API n8n |
| `N8N_WEBHOOK_URL` | URL du webhook n8n |

## 🔒 Sécurité

### Token d'authentification

⚠️ **Important** : Générez un token sécurisé pour `AUTH_TOKEN` :

```bash
# Génération d'un token sécurisé
openssl rand -hex 32

# Ou avec Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### HTTPS

Render.com fournit automatiquement :
- ✅ Certificats SSL/TLS gratuits
- ✅ HTTPS forcé
- ✅ Protection DDoS

## 📊 Monitoring et maintenance

### Endpoints de santé

- **Health Check** : `https://votre-service.onrender.com/health`
- **Métriques** : Disponibles dans le dashboard Render

### Logs

Accédez aux logs via :
- Dashboard Render → Votre service → Logs
- Render CLI : `render logs --service=n8n-mcp-server`

### Mise à jour

Les déploiements sont automatiques sur push vers la branche configurée.

Pour forcer un redéploiement :
```bash
render services restart --service=n8n-mcp-server
```

## 🏗️ Architecture sur Render.com

```
Internet → Render Load Balancer → n8n-MCP Container
                                 ├── SQLite Database (local storage)
                                 ├── Node.js Runtime
                                 └── MCP Server (HTTP mode)
```

### Ressources allouées

- **Plan Starter** (gratuit) :
  - 512 MB RAM
  - 0.1 CPU
  - Mise en veille après inactivité
  - SSL inclus

- **Plans payants** :
  - Plus de RAM/CPU
  - Pas de mise en veille
  - Support prioritaire

## 🚨 Dépannage

### Problèmes courants

1. **Erreur de build Docker**
   ```bash
   # Tester localement
   docker build -f Dockerfile.render -t n8n-mcp-test .
   ```

2. **Timeout au démarrage**
   - Vérifiez les logs dans le dashboard
   - Augmentez le timeout de health check si nécessaire

3. **Erreurs d'authentification**
   - Vérifiez que `AUTH_TOKEN` est défini
   - Le token doit faire au moins 32 caractères

4. **Problèmes de CORS**
   - Ajustez `CORS_ORIGIN` selon vos besoins
   - Pour un domaine spécifique : `CORS_ORIGIN=https://votredomaine.com`

### Support

- 📖 [Documentation Render.com](https://render.com/docs)
- 💬 [Community Forum](https://community.render.com)
- 🎫 Support technique via le dashboard

## 🔄 CI/CD avec GitHub Actions

Exemple de workflow pour auto-déploiement :

```yaml
# .github/workflows/deploy-render.yml
name: Deploy to Render
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Render
        uses: render-examples/github-action-render-deploy@v1.0.0
        with:
          service-id: ${{ secrets.RENDER_SERVICE_ID }}
          api-key: ${{ secrets.RENDER_API_KEY }}
```

## 🌟 Avantages de Render.com

- ✅ **Simple** : Déploiement en un clic
- ✅ **Gratuit** : Plan starter généreux
- ✅ **Sécurisé** : HTTPS et certificats automatiques
- ✅ **Évolutif** : Montée en charge facile
- ✅ **Moderne** : Support Docker natif

## 📚 Ressources utiles

- [Dashboard Render](https://dashboard.render.com)
- [Documentation officielle](https://render.com/docs)
- [Status Page](https://status.render.com)
- [Pricing](https://render.com/pricing)

---

🎉 **Félicitations !** Votre serveur n8n-MCP est maintenant déployé sur Render.com.

Pour toute question ou problème, consultez les logs et la documentation Render.com.