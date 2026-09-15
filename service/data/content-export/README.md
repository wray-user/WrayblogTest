# Wrayblog content export

This directory contains the versioned content backup exported from the local
`wrayblog` database.

Included:

- Public user metadata, without password hashes.
- Posts, category tags, and tags.
- Media referenced by posts, category covers, or the Wray avatar.

Excluded:

- Password hashes and JWT secrets.
- Visits, IP addresses, user agents, editor backups, comments, and logs.

To create a fresh export from the configured MongoDB instance:

```text
npm run export:content
```

To validate a restore without writing to MongoDB:

```text
npm run import:content -- --dry-run
```

To restore the export, configure `MONGO_URI`. If the Wray account does not
already exist, set `WRAY_PASSWORD` for the new account:

```text
npm run import:content
```

## Version control workflow

The JSON files and referenced media in this directory are intended to be
committed to Git. They are the portable content snapshot; the live MongoDB
database itself should not be committed.

On the local machine, export the latest database content before pushing:

```text
cd service
npm run export:content
cd ..
git add service/data/content-export
git commit -m "chore: update content export"
git push origin master
```

On the cloud server, pull the snapshot and restore it into the cloud MongoDB:

```text
git pull --ff-only origin master
cd service
npm ci
npm run import:content -- --dry-run
npm run import:content
```

Keep `service/.env` only on the machine where the service runs. It must contain
the target MongoDB connection string and, when importing into an empty
database, `WRAY_PASSWORD` for the initial Wray account.
