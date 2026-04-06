# Git Basics

## Setup

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global init.defaultBranch main
```

## Common Commands

### Status & Diff

```bash
git status                    # show working tree status
git diff                      # unstaged changes
git diff --staged             # staged changes
git diff HEAD~1               # diff against last commit
git log --oneline -20         # compact log
git log --oneline --graph     # branch graph
```

### Staging & Committing

```bash
git add <file>                # stage specific file
git add -p                    # interactive staging (hunks)
git commit -m "message"       # commit staged changes
git commit --amend            # amend last commit (unpushed)
git commit --amend --no-edit  # amend without editing message
```

### Branching

```bash
git switch -c <branch>        # create and switch to branch
git switch <branch>           # switch branch
git branch -d <branch>        # delete merged branch
git branch -D <branch>        # force delete branch
git branch -m <old> <new>     # rename branch
```

### Remote

```bash
git fetch --prune             # fetch and remove deleted remote branches
git pull --rebase             # pull with rebase instead of merge
git push -u origin <branch>   # push and set upstream
git push --force-with-lease   # safer force push
```

### Stash

```bash
git stash                     # stash uncommitted changes
git stash pop                 # apply and drop latest stash
git stash list                # list all stashes
git stash drop stash@{0}      # drop specific stash
```

### Reset & Restore

```bash
git restore <file>            # discard working tree changes
git restore --staged <file>   # unstage file
git reset HEAD~1              # undo last commit (keep changes staged)
git reset --soft HEAD~1       # undo last commit (keep changes unstaged)
git reset --hard HEAD~1       # undo last commit (discard changes)
```
