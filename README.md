# Markdown Previewer

A live Markdown editor and previewer built with HTML, CSS, and vanilla JavaScript. Write Markdown on the left and see the formatted output on the right as you type.

## Features

- **Live Preview** - Rendered output updates instantly while typing
- **Markdown Support** - Headings, bold, italic, strikethrough, inline code, fenced code blocks, links, images, blockquotes, horizontal rules, tables, ordered/unordered lists, nested lists, and task lists
- **Formatting Toolbar** - Quick buttons for common Markdown syntax
- **Keyboard Shortcuts** - `Ctrl+B` for bold, `Ctrl+I` for italic, `Ctrl+K` for links
- **Light & Dark Themes** - Toggle and automatically remembers your choice
- **Live Statistics** - Word, character, and line counts
- **Export Options** - Copy rendered HTML or download the Markdown as a `.md` file
- **Autosave** - Draft content is saved in `localStorage`
- **Responsive Design** - Side-by-side on desktop, stacked on mobile

## How to Use

1. Open `index.html` in a web browser
2. Type Markdown in the editor, or click **Load Sample** to see an example
3. The preview pane updates automatically
4. Use the toolbar or keyboard shortcuts to insert formatting
5. Click **Copy HTML** to copy the rendered markup
6. Click **Download .md** to save your Markdown file

## Markdown Examples

```markdown
# Heading 1
## Heading 2

**Bold**, *italic*, ~~strikethrough~~, and `inline code`

- Bullet item
- [ ] Task item
- [x] Completed task

> A blockquote

| Column A | Column B |
| :--- | ---: |
| Value | Value |

[Link](https://example.com)

![Alt text](https://example.com/image.png)

```js
console.log('Hello, world!');
```
```

## Files

- `index.html` - App structure and toolbar
- `style.css` - Themes, layout, and responsive styles
- `app.js` - Markdown parser and editor interactions

## Technologies Used

- HTML5
- CSS3 (custom properties, Flexbox, Grid)
- Vanilla JavaScript (ES5-compatible syntax, no dependencies)

## Security Note

Raw HTML in Markdown is escaped before rendering, and `javascript:`, `vbscript:`, and `data:` URLs are blocked in links and images.
