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
