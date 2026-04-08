# Shell Tips

## Navigation

```bash
cd -                          # switch to previous directory
pushd <dir>                   # push dir onto stack and cd
popd                          # pop stack and cd back
dirs                          # show directory stack

# Jump with fzf
cd $(find . -type d | fzf)
```

## History

```bash
!!                            # repeat last command
!$                            # last argument of last command
!^                            # first argument of last command
ctrl+r                        # reverse search history
history | grep <term>         # search history
```

## File Operations

```bash
cp -r src/ dst/               # copy directory recursively
mv *.txt archive/             # move glob matches
rm -rf dir/                   # remove directory (careful!)

# Safe remove (move to trash)
# brew install trash
trash file.txt

# Find and delete
find . -name "*.log" -delete
find . -name "*.pyc" -exec rm {} +
```

## Text Processing

```bash
# grep
grep -r 'pattern' .           # recursive search
grep -rl 'pattern' .          # only file names
grep -n 'pattern' file        # with line numbers
grep -v 'pattern' file        # invert match
grep -A3 -B3 'pattern' file   # context lines

# sed
sed 's/old/new/g' file        # replace all in file
sed -i '' 's/old/new/g' file  # in-place (macOS)
sed -n '10,20p' file          # print lines 10-20

# awk
awk '{print $1}' file         # print first column
awk -F: '{print $1}' /etc/passwd
awk 'NR==5' file              # print line 5

# cut / sort / uniq
cut -d, -f2 file.csv          # csv second column
sort -k2 -n file              # sort by column 2 numerically
sort | uniq -c | sort -rn     # count occurrences
```

## Process Management

```bash
ps aux | grep <name>          # find process
kill -9 <pid>                 # force kill
pkill <name>                  # kill by name
lsof -i :<port>               # find process on port
```

## Useful One-liners

```bash
# Count lines of code
find . -name '*.ts' | xargs wc -l | sort -rn

# Watch a command every 2s
watch -n2 'docker ps'

# Follow multiple log files
tail -f log1.txt log2.txt

# Show disk usage
du -sh */ | sort -rh

# Extract tarball
tar -xzf archive.tar.gz -C /target/dir/

# Generate a random string
openssl rand -hex 16
```

## Environment Variables

```bash
export VAR=value              # set for current session
unset VAR                     # remove variable
printenv                      # list all env vars
env VAR=value command         # set for one command only

# Load .env file
set -a && source .env && set +a
# or:
export $(grep -v '^#' .env | xargs)
```
