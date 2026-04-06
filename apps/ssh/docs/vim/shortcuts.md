# Vim Shortcuts

## Modes

| Key | Action |
|-----|--------|
| `i` | Insert before cursor |
| `a` | Insert after cursor |
| `I` | Insert at line start |
| `A` | Insert at line end |
| `o` | New line below, insert |
| `O` | New line above, insert |
| `Esc` | Return to Normal mode |
| `v` | Visual mode |
| `V` | Visual line mode |
| `Ctrl+v` | Visual block mode |

## Navigation

```
h j k l       left / down / up / right
w / b         next / prev word
e             end of word
0 / $         start / end of line
^             first non-blank character
gg / G        top / bottom of file
{N}G          go to line N
Ctrl+f / b    page down / up
Ctrl+d / u    half page down / up
%             jump to matching bracket
*             search for word under cursor
```

## Editing

```
x             delete character
dd            delete line
dw            delete word
d$            delete to end of line
D             delete to end of line (alias)
cc            change (delete and insert) line
cw            change word
yy            yank (copy) line
yw            yank word
p / P         paste after / before cursor
u             undo
Ctrl+r        redo
.             repeat last change
```

## Search & Replace

```
/pattern      search forward
?pattern      search backward
n / N         next / previous match
:%s/old/new/g replace all in file
:%s/old/new/gc replace with confirmation
:5,10s/old/new/g replace in lines 5-10
```

## File & Buffer

```
:w            save
:q            quit
:wq / ZZ      save and quit
:q!           quit without saving
:e file       open file
:bn / :bp     next / previous buffer
:ls           list buffers
Ctrl+^        switch to last buffer
```

## Splits & Windows

```
:sp file      horizontal split
:vsp file     vertical split
Ctrl+w h/j/k/l  move between splits
Ctrl+w =      equalize split sizes
Ctrl+w _      maximize height
Ctrl+w |      maximize width
:q            close split
```

## Marks & Jumps

```
ma            set mark 'a'
'a            jump to mark 'a' (line)
`a            jump to mark 'a' (exact position)
''            jump to last jump position
Ctrl+o / i    jump back / forward in jump list
```

## Macros

```
qa            start recording macro into 'a'
q             stop recording
@a            play macro 'a'
@@            repeat last macro
10@a          play macro 10 times
```
