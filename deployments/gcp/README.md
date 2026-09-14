# Deploying to the GCP VM (plane-pm)

Automated via `.github/workflows/deploy-gcp.yml`: every push to `preview`
SSHes into the VM (over an IAP tunnel, so no SSH port has to be open to the
internet) and runs `deployments/gcp/deploy.sh`, which pulls the branch,
rebuilds changed Docker images, and restarts everything with
`docker compose up -d` (this also re-runs the one-shot `migrator` service,
so migrations are applied automatically).

You can also trigger a deploy manually any time from GitHub: **Actions ->
Deploy to GCP VM -> Run workflow**.

## One-time setup

Run these once (from a machine with `gcloud` already authenticated to the
`project-management-tpp` project -- e.g. your own machine, since you already
use `gcloud compute ssh` there).

**1. Confirm the deploy directory on the VM.** SSH in and check where the
repo lives:

```
gcloud compute ssh plane-pm --project=project-management-tpp --zone=asia-south1-a
pwd   # note this path -- it's your DEPLOY_DIR below
```

**2. Enable OS Login on the VM** (if not already -- this is what lets a
service account's IAM role stand in for an SSH key, no manual key
management):

```
gcloud compute instances add-metadata plane-pm \
  --project=project-management-tpp --zone=asia-south1-a \
  --metadata enable-oslogin=TRUE
```

**3. Create a service account for GitHub Actions to deploy as:**

```
gcloud iam service-accounts create github-deployer \
  --project=project-management-tpp \
  --display-name="GitHub Actions deployer"
```

**4. Grant it just enough IAM to SSH in over IAP:**

```
SA=github-deployer@project-management-tpp.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding project-management-tpp \
  --member="serviceAccount:$SA" --role="roles/compute.osLogin"

gcloud projects add-iam-policy-binding project-management-tpp \
  --member="serviceAccount:$SA" --role="roles/iap.tunnelResourceAccessor"

gcloud projects add-iam-policy-binding project-management-tpp \
  --member="serviceAccount:$SA" --role="roles/compute.viewer"
```

**5. Allow IAP's SSH range through the firewall** (skip if a rule allowing
`35.235.240.0/20` on `tcp:22` already exists -- check with
`gcloud compute firewall-rules list`):

```
gcloud compute firewall-rules create allow-iap-ssh \
  --project=project-management-tpp \
  --direction=INGRESS --action=ALLOW --rules=tcp:22 \
  --source-ranges=35.235.240.0/20
```

**6. Create a key for the service account and download it:**

```
gcloud iam service-accounts keys create github-deployer-key.json \
  --iam-account="$SA"
```

**7. Add these to the GitHub repo** (Settings -> Secrets and variables ->
Actions):

- Secret `GCP_SA_KEY` -- the full contents of `github-deployer-key.json`
  (then delete the local copy of that file -- it's a live credential)
- Variable `GCP_PROJECT_ID` -- `project-management-tpp`
- Variable `GCP_INSTANCE` -- `plane-pm`
- Variable `GCP_ZONE` -- `asia-south1-a`
- Variable `DEPLOY_DIR` -- the path you noted in step 1

That's it -- the next push to `preview` will deploy automatically.

## Rolling back

If a deploy goes bad, SSH in and reset to the previous commit, then re-run
the deploy script against it:

```
gcloud compute ssh plane-pm --project=project-management-tpp --zone=asia-south1-a
cd <DEPLOY_DIR>
git log --oneline -5        # find the commit to roll back to
git reset --hard <commit>
bash deployments/gcp/deploy.sh
```
