# TutorDesk — Hostinger VPS Deployment Guide

This guide walks you through the complete setup on Hostinger from a fresh VPS to
having your first customer live, with automated updates and daily backups.

---

## Table of Contents

1. [Prerequisites — Hostinger Setup](#1-prerequisites--hostinger-setup)
2. [VPS Initial Setup](#2-vps-initial-setup)
3. [Install Dependencies](#3-install-dependencies)
4. [Configure the Deployment System](#4-configure-the-deployment-system)
5. [Docker Hub — Push Your Images](#5-docker-hub--push-your-images)
6. [GitHub Actions Secrets](#6-github-actions-secrets)
7. [Deploy Your First Customer](#7-deploy-your-first-customer)
8. [Set Up Daily Backups](#8-set-up-daily-backups)
9. [Rolling Updates (new version)](#9-rolling-updates-new-version)
10. [Accessing Customers as Super Admin](#10-accessing-customers-as-super-admin)
11. [Selling Self-Hosted Copies](#11-selling-self-hosted-copies)
12. [Monitoring and Logs](#12-monitoring-and-logs)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites — Hostinger Setup

### Buy a VPS

1. Go to **hostinger.com → VPS Hosting**
2. Choose **KVM 2** (2 vCPU, 8 GB RAM) or higher
   - KVM 2 handles roughly 5–10 small customer instances
   - Upgrade to KVM 4 when you have 10+ customers
3. Select **Ubuntu 22.04 LTS** as the OS
4. Choose a datacenter close to your customers

### DNS Configuration

In Hostinger's DNS panel (or your domain registrar):

```
Type  Name       Value
A     @          <Your VPS IP>
A     *          <Your VPS IP>    ← wildcard: catches *.tutordesk.com
```

The wildcard `*` record means any subdomain automatically points to your VPS.
Certbot issues per-subdomain SSL certificates automatically.

---

## 2. VPS Initial Setup

SSH into your VPS:

```bash
ssh root@<your-vps-ip>
```

### Secure the server

```bash
# Update system
apt update && apt upgrade -y

# Create a non-root deploy user
adduser deploy
usermod -aG sudo deploy

# Copy your SSH key to the deploy user
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Disable root SSH login
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

From now on, SSH as `deploy`:

```bash
ssh deploy@<your-vps-ip>
```

### Configure firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 3. Install Dependencies

Run these commands as the `deploy` user:

### Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
newgrp docker        # apply group without logout
docker --version     # verify
```

### Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Certbot (SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### rclone (optional — for cloud backup sync)

```bash
curl https://rclone.org/install.sh | sudo bash
# Configure a remote named "backup":
rclone config
# Follow prompts to connect to S3, Google Drive, Hostinger Object Storage, etc.
```

### Other utilities

```bash
sudo apt install -y openssl iproute2
```

---

## 4. Configure the Deployment System

### Create directory structure

```bash
sudo mkdir -p /opt/tutordesk/{customers,backups,templates,scripts,nginx}
sudo chown -R deploy:deploy /opt/tutordesk
```

### Copy deployment files from your repository

On your **local machine**:

```bash
# From the workspace root
scp deploy/docker-compose.template.yml   deploy@<vps-ip>:/opt/tutordesk/templates/
scp deploy/nginx/vhost.template          deploy@<vps-ip>:/opt/tutordesk/nginx/
scp deploy/scripts/provision.sh         deploy@<vps-ip>:/opt/tutordesk/scripts/
scp deploy/scripts/update.sh            deploy@<vps-ip>:/opt/tutordesk/scripts/
scp deploy/scripts/backup.sh            deploy@<vps-ip>:/opt/tutordesk/scripts/
scp deploy/scripts/remove-customer.sh   deploy@<vps-ip>:/opt/tutordesk/scripts/
scp deploy/nginx/add-vhost.sh           deploy@<vps-ip>:/opt/tutordesk/nginx/
```

On the **VPS**:

```bash
chmod +x /opt/tutordesk/scripts/*.sh
chmod +x /opt/tutordesk/nginx/add-vhost.sh

# Symlink add-vhost.sh into scripts/ for convenience
ln -s /opt/tutordesk/nginx/add-vhost.sh /opt/tutordesk/scripts/add-vhost.sh
```

### Set global environment variables

These are set once on the VPS and inherited by all customer stacks:

```bash
sudo nano /etc/environment
```

Add these lines (replace with your actual values):

```
SUPER_ADMIN_KEY=your_very_long_random_master_key_here
DOCKER_IMAGE_API=yourdockerhubusername/tutordesk-api
DOCKER_IMAGE_WEB=yourdockerhubusername/tutordesk-web
```

Generate the SUPER_ADMIN_KEY securely:

```bash
openssl rand -base64 48
# Copy the output — this is your master key. Store it somewhere safe (password manager).
```

Apply the env vars:

```bash
source /etc/environment
```

### Nginx default site cleanup

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -s reload
```

---

## 5. Docker Hub — Push Your Images

### Create a Docker Hub account

1. Go to hub.docker.com and create a free account
2. Create two **public** repositories:
   - `yourusername/tutordesk-api`
   - `yourusername/tutordesk-web`

### Build and push manually (first time)

On your **local machine** from the workspace root:

```bash
# Login to Docker Hub
docker login

# Build and push API image
docker build \
  -t yourusername/tutordesk-api:v1.0.0 \
  -t yourusername/tutordesk-api:latest \
  -f apps/api/Dockerfile \
  .

docker push yourusername/tutordesk-api:v1.0.0
docker push yourusername/tutordesk-api:latest

# Build and push Web image (takes longer — full npm install + ng build)
docker build \
  -t yourusername/tutordesk-web:v1.0.0 \
  -t yourusername/tutordesk-web:latest \
  -f apps/web/Dockerfile \
  .

docker push yourusername/tutordesk-web:v1.0.0
docker push yourusername/tutordesk-web:latest
```

After this first manual push, GitHub Actions will handle it automatically on every release tag.

---

## 6. GitHub Actions Secrets

In your GitHub repository → **Settings → Secrets and variables → Actions**,
add these secrets:

| Secret Name        | Value                                        |
|--------------------|----------------------------------------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username                   |
| `DOCKERHUB_TOKEN`   | Docker Hub access token (not your password) |
| `VPS_HOST`          | Your VPS IP address                         |
| `VPS_USER`          | `deploy`                                    |
| `VPS_SSH_KEY`       | Contents of `~/.ssh/id_rsa` (private key)  |
| `VPS_PORT`          | `22` (or your custom SSH port)             |

To get a Docker Hub access token:
1. hub.docker.com → Account Settings → Security → New Access Token
2. Copy the token immediately (shown only once)

Also create a **GitHub Environment** named `production`:
- Repository → Settings → Environments → New environment → `production`
- Enable "Required reviewers" and add yourself
- This requires your manual approval before rolling out to all customers

---

## 7. Deploy Your First Customer

SSH into your VPS and run:

```bash
/opt/tutordesk/scripts/provision.sh \
  school-abc \
  school-abc.tutordesk.com \
  admin@school-abc.com \
  v1.0.0
```

**What happens:**
1. Generates unique DB credentials and JWT secret
2. Finds available ports automatically
3. Creates `/opt/tutordesk/customers/school-abc/.env`
4. Pulls Docker images and starts containers (db + api + web)
5. Go API applies DB migrations automatically on startup
6. Creates Nginx vhost
7. Issues SSL certificate via Let's Encrypt

**Verify it's working:**

```bash
# Check containers
docker ps | grep school-abc

# Check API health
curl https://school-abc.tutordesk.com/api/v1/health

# View logs
docker compose -f /opt/tutordesk/customers/school-abc/docker-compose.yml logs -f
```

---

## 8. Set Up Daily Backups

Add the backup script to cron:

```bash
crontab -e
```

Add this line:

```cron
0 2 * * * /opt/tutordesk/scripts/backup.sh >> /var/log/tutordesk-backup.log 2>&1
```

This runs every night at 2 AM. Backups are stored in `/opt/tutordesk/backups/`.

**To restore a specific customer's database:**

```bash
# List available backups
ls /opt/tutordesk/backups/school-abc/

# Restore a specific backup
source /opt/tutordesk/customers/school-abc/.env

gunzip -c /opt/tutordesk/backups/school-abc/db_20260402_020000.sql.gz \
  | docker exec -i school-abc_db psql -U "$DB_USER" "$DB_NAME"
```

**Optional: sync to Hostinger Object Storage**

Configure rclone with Hostinger's S3-compatible storage:

```bash
rclone config
# Name: backup
# Type: s3
# Provider: Other (Hostinger uses S3-compatible API)
# Access Key ID: (from Hostinger Object Storage dashboard)
# Secret Access Key: (from Hostinger Object Storage dashboard)
# Endpoint: (from Hostinger dashboard, e.g. s3.eu-central-1.hostingerapp.com)
# Region: leave blank or set region
```

The backup.sh script automatically syncs to `backup:tutordesk-backups/` if rclone is configured.

---

## 9. Rolling Updates (new version)

### Automated (recommended)

Push a version tag to trigger GitHub Actions:

```bash
# On your local machine
git tag v1.2.0
git push origin v1.2.0
```

GitHub Actions will:
1. Build and push new Docker images tagged `v1.2.0` and `latest`
2. Wait for your approval in GitHub (production environment protection)
3. SSH into VPS and run the rolling update for all customers

### Manual update

```bash
# Update all customers
/opt/tutordesk/scripts/update.sh v1.2.0

# Update one customer only
/opt/tutordesk/scripts/update.sh v1.2.0 school-abc
```

**How zero-downtime updates work:**
1. Pulls new images while old containers keep running
2. Restarts API first — DB migrations run automatically on startup via `database.RunMigrations`
3. Waits for API health check to pass
4. Restarts web container
5. If anything fails, the old version is still serving traffic

---

## 10. Accessing Customers as Super Admin

You have a master key (`SUPER_ADMIN_KEY`) that gives you full `super_admin` access
to **any** customer's instance without knowing their password or JWT token.

**Using the Super Admin key:**

```bash
# Access any API endpoint as super_admin on any customer instance
curl -H "X-Super-Admin-Key: your_master_key_here" \
  https://school-abc.tutordesk.com/api/v1/admin/stats

# Get all teachers on a customer's instance
curl -H "X-Super-Admin-Key: your_master_key_here" \
  https://school-abc.tutordesk.com/api/v1/teachers
```

**From the web UI:**
Currently the web UI uses standard JWT auth. To access a customer instance via the UI,
you can either:
1. Log in as the customer's admin user (ask them to provide credentials)
2. Create a super_admin user on their DB directly (one-time setup):
   ```bash
   source /opt/tutordesk/customers/school-abc/.env
   docker exec -it school-abc_db psql -U "$DB_USER" "$DB_NAME" -c "
     INSERT INTO users (email, password_hash, full_name, user_role, status)
     VALUES ('platform@tutordesk.app', '<bcrypt_hash>', 'Platform Admin', 'super_admin', 'active');
   "
   ```

The `X-Super-Admin-Key` is **never** shared with customers. It is set in
`/etc/environment` on your VPS and injected into each container via docker-compose.

---

## 11. Selling Self-Hosted Copies

For customers who want to run TutorDesk on their own server:

1. Package the `deploy/self-hosted/` folder as a zip
2. The customer downloads it, runs `./setup.sh`, and they're live
3. They pull your images from Docker Hub — you control what versions they can access
4. To sell: keep your Docker Hub repos **private** (requires Docker Hub Pro, ~$5/mo)
   - Give paying customers a read-only Docker Hub token
   - Revoke the token when their subscription expires

**To share:**

```bash
# On your local machine
cd deploy/
zip -r tutordesk-self-hosted.zip self-hosted/
```

The `setup.sh` prompts them for their domain and generates all secrets automatically.
They only need to fill in their bKash credentials.

---

## 12. Monitoring and Logs

### View logs for a customer

```bash
docker compose -f /opt/tutordesk/customers/school-abc/docker-compose.yml logs -f
docker compose -f /opt/tutordesk/customers/school-abc/docker-compose.yml logs -f api
docker compose -f /opt/tutordesk/customers/school-abc/docker-compose.yml logs -f db
```

### Check container status

```bash
# All tutordesk containers
docker ps --filter "name=school-abc"

# All customers at once
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check disk usage

```bash
df -h
docker system df
du -sh /opt/tutordesk/backups/
```

### Restart a stuck container

```bash
docker restart school-abc_api
docker restart school-abc_web
```

---

## 13. Troubleshooting

### API container won't start

```bash
docker logs school-abc_api
```

Common causes:
- DB not ready yet → wait 10s and retry
- Wrong DATABASE_URL → check `.env` file
- Migration failed → check logs for SQL errors

### SSL certificate issues

```bash
# Re-issue certificate
sudo certbot --nginx -d school-abc.tutordesk.com --force-renewal

# Check certificate status
sudo certbot certificates
```

### Port conflict during provisioning

```bash
# See what's using a port
ss -tlnp | grep :8101

# Find all used ports
docker ps --format "{{.Ports}}" | tr ',' '\n' | grep -oP ':\d+' | sort -u
```

### Database connection refused

```bash
# Check if DB container is healthy
docker inspect school-abc_db | grep -A 5 Health

# Connect manually to verify
docker exec -it school-abc_db psql -U td_school_abc tutordesk_school_abc
```

### Out of disk space

```bash
# Clean unused Docker images
docker image prune -f

# Remove old images (keep current version)
docker images | grep tutordesk | grep -v v1.2.0 | awk '{print $3}' | xargs docker rmi
```

---

## Quick Reference

```bash
# Provision new customer
/opt/tutordesk/scripts/provision.sh <id> <domain> <email> <version>

# Update all customers
/opt/tutordesk/scripts/update.sh <version>

# Remove a customer (takes backup first)
/opt/tutordesk/scripts/remove-customer.sh <id> --confirm

# Manual backup
/opt/tutordesk/scripts/backup.sh

# View all customer logs
for d in /opt/tutordesk/customers/*/; do
  echo "=== $(basename $d) ===";
  docker compose -f "$d/docker-compose.yml" logs --tail=5 api 2>/dev/null;
done
```
