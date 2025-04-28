import React from 'react';
import { marked } from 'marked';
import './MarkdownRenderer.css';

// Configure marked to render links with target="_blank"
const renderer = new marked.Renderer();
renderer.link = (href, title, text) => {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="chat-link">${text}</a>`;
};

marked.setOptions({
  renderer,
  breaks: true,
  gfm: true
});

function MarkdownRenderer({ content }) {
  if (!content) return null;
  
  // Process content to enhance links and other formatting
  const processedContent = content
    // Make sure URLs are formatted as markdown links if they aren't already
    .replace(
      /(?<![[(])https?:\/\/[^\s\]]+/g, 
      url => {
        // Skip if URL is already in a markdown link
        if (content.includes(`[`) && content.includes(`](${url})`)) {
          return url;
        }
        // Create a more user-friendly link text
        let linkText = url;
        try {
          const urlObj = new URL(url);
          linkText = urlObj.hostname.replace('www.', '');
          
          // Add path hint 
          if (urlObj.pathname && urlObj.pathname !== '/') {
            const pathParts = urlObj.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            if (lastPart) {
              linkText += `: ${decodeURIComponent(lastPart.replace(/[-_]/g, ' '))}`;
            }
          }
        } catch (e) {
          // Use full URL if parsing fails
        }
        
        return `[${linkText}](${url})`;
      }
    );
  
  // Use marked to render markdown
  const html = marked(processedContent);
  
  return (
    <div 
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default MarkdownRenderer;