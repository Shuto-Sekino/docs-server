# Git Workflow

## Feature Branch Workflow

```bash
# 1. Start from up-to-date main
git switch main
git pull

# 2. Create feature branch
git switch -c feat/my-feature

# 3. Work, commit often
git add -p
git commit -m "feat: add X"

# 4. Keep up with main
git fetch origin
git rebase origin/main

# 5. Push and open PR
git push -u origin feat/my-feature
```

## Useful Aliases

Add to `~/.gitconfig`:

```ini
[alias]
  lg = log --oneline --graph --decorate --all
  st = status -sb
  co = switch
  br = branch
  undo = reset HEAD~1
  staged = diff --staged
```

## Commit Message Convention

```
<type>(<scope>): <short summary>

Types: feat | fix | docs | refactor | test | chore | perf
```

Examples:
```
feat(auth): add OAuth2 login
fix(api): handle null response from upstream
docs: update README setup instructions
refactor(db): extract query builder
```

## Resolving Merge Conflicts

```bash
# During rebase or merge
git status                    # see conflicting files
# edit files, resolve <<<<< markers
git add <resolved-file>
git rebase --continue         # or: git merge --continue

# Abort if needed
git rebase --abort
git merge --abort
```

## Bisect (Find Regression)

```bash
git bisect start
git bisect bad                # current commit is broken
git bisect good v1.0.0        # last known good commit
# git checks out commits; test each one, then:
git bisect good               # or: git bisect bad
# repeat until git identifies the culprit
git bisect reset
```

## Cleanup Old Branches

```bash
# Fetch and prune remote-tracking refs
git fetch --prune

# Delete branches already merged into main
git branch --merged main | grep -v main | xargs git branch -d
```
