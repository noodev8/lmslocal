import fs from 'fs';
import path from 'path';

export interface HelpPageData {
  title: string;
  description: string;
  content: string;
  keywords?: string;
}

const contentDir = path.join(process.cwd(), 'src', 'content', 'help');

// Simple markdown to HTML converter for basic formatting
function markdownToHtml(markdown: string): string {
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

export async function getHelpPage(slug: string): Promise<HelpPageData | null> {
  try {
    const filePath = path.join(contentDir, `${slug}.md`);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Extract title from first line
    const lines = fileContent.split('\n');
    const titleMatch = lines[0].match(/^# (.+)$/);
    const title = titleMatch ? titleMatch[1] : slug;

    // Generate description from first paragraph
    const description = fileContent
      .split('\n')
      .find(line => line.length > 50 && !line.startsWith('#'))
      ?.substring(0, 160) + '...' || `Help documentation for ${title}`;

    // Convert markdown to HTML
    const content = markdownToHtml(fileContent);

    return {
      title,
      description,
      content,
      keywords: `last man standing, ${slug.replace(/-/g, ' ')}, help, guide`
    };
  } catch (error) {
    return null;
  }
}

export function getAllHelpPages(): string[] {
  try {
    return fs.readdirSync(contentDir)
      .filter(file => file.endsWith('.md'))
      .map(file => file.replace('.md', ''));
  } catch (error) {
    return [];
  }
}