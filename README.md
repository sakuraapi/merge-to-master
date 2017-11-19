# Installing

Simplifies a definable procedural merge to master (helpful if you're using git flow, or if 
your CI/CD system deploys anything committed to master to your production environment, or something like that).

`npm install -g @sakuraapi/merge-to-master`

`m2m help`

# Configuration
By default, merge-to-master looks for `.m2m`. You can override this with
the `-c` argument (see `m2m help`).

```
{
  "before": [
    "./scripts/some-script.js",
    "npm run someScript"
  ],
  "after": [
  ]
}
```

`"before"` happens before the merge. Any script returning a non-zero value will prevent the merge from
happening.

`"after"` happens after the merge happens... use it for cleanup, or tickling your CI system, or whatever.

`m2m` expects either a script file which starts with a `./` or some command to run, like `npm -v`.
