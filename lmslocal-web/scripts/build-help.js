/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const contentDir = path.join(__dirname, '..', 'src', 'content', 'help');
const outputDir = path.join(__dirname, '..', 'public', 'help');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Simple markdown to HTML converter
function markdownToHtml(markdown) {
  return markdown
    // Headers
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')

    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

    // Code blocks
    .replace(/`([^`]+)`/g, '<code>$1</code>')

    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')

    // Clean up empty paragraphs and fix list formatting
    .replace(/<p><h/g, '<h')
    .replace(/<\/h([123])><\/p>/g, '</h$1>')
    .replace(/<p><ul>/g, '<ul>')
    .replace(/<\/ul><\/p>/g, '</ul>')
    .replace(/<p><li>/g, '<li>')
    .replace(/<\/li><\/p>/g, '</li>')
    .replace(/<p><\/p>/g, '')
    .replace(/<p>---<\/p>/g, '<hr>');
}

// HTML template
function createHtmlPage(title, content, description) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - LMSLocal Help</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="last man standing, ${title.toLowerCase()}, help, guide">

  <!-- Open Graph -->
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:type" content="article">

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    .content { max-width: 64rem; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2.25rem; font-weight: 700; color: #0f172a; margin-bottom: 1.5rem; }
    h2 { font-size: 1.5rem; font-weight: 600; color: #0f172a; margin-top: 2rem; margin-bottom: 1rem; }
    h3 { font-size: 1.25rem; font-weight: 600; color: #0f172a; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    p { color: #475569; line-height: 1.625; margin-bottom: 1rem; }
    ul { margin: 1.5rem 0; }
    li { margin: 0.5rem 0; color: #475569; }
    a { color: #2563eb; text-decoration: underline; }
    a:hover { color: #1d4ed8; }
    strong { color: #0f172a; font-weight: 600; }
    hr { border-color: #e2e8f0; margin: 2rem 0; }
    code { background-color: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="content">
    ${content}
  </div>
</body>
</html>`;
}

// Process all markdown files
function buildHelpPages() {
  const files = fs.readdirSync(contentDir).filter(file => file.endsWith('.md'));

  files.forEach(file => {
    const filePath = path.join(contentDir, file);
    const markdown = fs.readFileSync(filePath, 'utf8');

    // Extract title from first line
    const lines = markdown.split('\n');
    const titleMatch = lines[0].match(/^# (.+)$/);
    const title = titleMatch ? titleMatch[1] : file.replace('.md', '');

    // Generate description from first paragraph
    const description = markdown
      .split('\n')
      .find(line => line.length > 50 && !line.startsWith('#'))
      ?.substring(0, 160) + '...' || `Help documentation for ${title}`;

    // Convert to HTML
    const content = markdownToHtml(markdown);
    const html = createHtmlPage(title, content, description);

    // Write HTML file
    const outputFile = path.join(outputDir, file.replace('.md', '.html'));
    fs.writeFileSync(outputFile, html);

    console.log(`✓ Generated ${file.replace('.md', '.html')}`);
  });
}

buildHelpPages();
console.log('🎉 Help pages built successfully!');