import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { cardCommentsSignal } from '../signals/realtimeState.js';
import { DEFAULT_INITIAL_SHEET } from '../sub_components/Card/LUMEN_sheets_card.jsx';

// Helper to escape XML characters for WordprocessingML
export const escape_xml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Clean string for safe file names
export const sanitize_filename = (name, default_name = 'lumen_board') => {
  if (!name || typeof name !== 'string') return default_name;
  const clean = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s-]+/g, '_');
  return clean || default_name;
};

// Trigger browser download for Blob or data URL
export const trigger_download = (blob_or_url, filename) => {
  const is_blob = blob_or_url instanceof Blob;
  const url = is_blob ? URL.createObjectURL(blob_or_url) : blob_or_url;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (is_blob) {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};

// Scan board and retrieve list of all unique images and uploaded files
export const get_board_asset_list = (board) => {
  if (!board || !Array.isArray(board.cards)) return [];
  const assets = [];
  const seen_urls = new Set();

  board.cards.forEach((card) => {
    // 1. Image card / carousel slides
    if (card.type === 'image') {
      if (Array.isArray(card.images) && card.images.length > 0) {
        card.images.forEach((img, idx) => {
          if (img.url && !seen_urls.has(img.url)) {
            seen_urls.add(img.url);
            assets.push({
              id: `${card.id}_slide_${idx}`,
              card_id: card.id,
              card_title: card.title || `Image_${card.id}`,
              type: 'image',
              name: `${sanitize_filename(card.title || 'image')}_slide_${idx + 1}.jpg`,
              url: img.url,
              caption: img.caption || '',
            });
          }
        });
      } else if (card.imageUrl && !seen_urls.has(card.imageUrl)) {
        seen_urls.add(card.imageUrl);
        assets.push({
          id: `${card.id}_main`,
          card_id: card.id,
          card_title: card.title || `Image_${card.id}`,
          type: 'image',
          name: `${sanitize_filename(card.title || 'image')}.jpg`,
          url: card.imageUrl,
          caption: card.caption || '',
        });
      }
    }

    // 2. File attachment card
    if (card.type === 'file' && (card.fileUrl || card.url)) {
      const file_url = card.fileUrl || card.url;
      if (!seen_urls.has(file_url)) {
        seen_urls.add(file_url);
        assets.push({
          id: `${card.id}_file`,
          card_id: card.id,
          card_title: card.title || card.fileName || 'Attached File',
          type: 'file',
          name: card.fileName || `${sanitize_filename(card.title || 'file')}.dat`,
          url: file_url,
          size: card.fileSize || '',
          mime: card.fileType || '',
        });
      }
    }

    // 3. Media cover/preview in embed or social card
    if ((card.type === 'embed' || card.type === 'social') && card.cover_image) {
      if (!seen_urls.has(card.cover_image)) {
        seen_urls.add(card.cover_image);
        assets.push({
          id: `${card.id}_cover`,
          card_id: card.id,
          card_title: card.title || 'Media Preview',
          type: 'image',
          name: `${sanitize_filename(card.title || 'preview')}_thumb.jpg`,
          url: card.cover_image,
          caption: card.description || '',
        });
      }
    }
  });

  return assets;
};

// Count summary for UI badges
export const get_board_asset_count = (board) => {
  const assets = get_board_asset_list(board);
  const image_count = assets.filter((a) => a.type === 'image').length;
  const file_count = assets.filter((a) => a.type === 'file').length;
  return {
    total_count: assets.length,
    image_count,
    file_count,
    assets,
  };
};

// ============================================================================
// 1. MARKDOWN EXPORT
// ============================================================================
export const generate_board_markdown = (board) => {
  if (!board) return '';
  const lines = [];

  const title = board.title || 'Untitled Board';
  const description = board.description || '';
  const updated_date = board.updatedAt
    ? new Date(board.updatedAt).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString();

  lines.push(`# ${title}`);
  if (description) {
    lines.push(`> ${description}`);
  }
  lines.push('');
  lines.push(`*Exported from Lumen Spatial Workspace · ${updated_date}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const cards = board.cards || [];

  // Group cards by group container if present
  const groups = cards.filter((c) => c.type === 'group');
  const grouped_card_ids = new Set();
  groups.forEach((g) => {
    (g.card_ids || []).forEach((id) => grouped_card_ids.add(id));
  });

  // Render Groups first
  groups.forEach((group) => {
    lines.push(`## 📂 Group: ${group.title || 'Untitled Group'}`);
    if (group.description) {
      lines.push(`*${group.description}*`);
    }
    lines.push('');

    const member_cards = (group.card_ids || [])
      .map((id) => cards.find((c) => c.id === id))
      .filter(Boolean);

    member_cards.forEach((card) => {
      render_card_markdown(card, lines, 3);
    });

    lines.push('---');
    lines.push('');
  });

  // Render Non-Grouped Cards in reading order (top to bottom, left to right)
  const ungrouped_cards = cards
    .filter((c) => c.type !== 'group' && !grouped_card_ids.has(c.id))
    .sort((a, b) => (a.y === b.y ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0)));

  ungrouped_cards.forEach((card) => {
    render_card_markdown(card, lines, 2);
  });

  return lines.join('\n');
};

const render_card_markdown = (card, lines, heading_level = 2) => {
  const h_prefix = '#'.repeat(heading_level);
  const card_title = card.title || '';

  switch (card.type) {
    case 'heading':
      lines.push(`${h_prefix} ${card_title || 'Section Heading'}`);
      if (card.content) {
        lines.push(card.content);
      }
      lines.push('');
      break;

    case 'note':
      lines.push(`${h_prefix} 📝 ${card_title || 'Note'}`);
      if (card.content) {
        lines.push(card.content);
        lines.push('');
      }
      if (card.ai_notes) {
        lines.push(`> 💡 **AI Insight:** ${card.ai_notes}`);
        lines.push('');
      }
      if (card.tags && card.tags.length > 0) {
        const tag_texts = card.tags.map((t) => `#${typeof t === 'string' ? t : t.text}`).join(' ');
        lines.push(`**Tags:** \`${tag_texts}\``);
        lines.push('');
      }
      break;

    case 'tasklist':
      lines.push(`${h_prefix} ☑️ ${card_title || 'Milestone Checklist'}`);
      if (Array.isArray(card.items) && card.items.length > 0) {
        card.items.forEach((item) => {
          lines.push(`- [${item.done ? 'x' : ' '}] ${item.text}`);
        });
        lines.push('');
      }
      if (card.tags && card.tags.length > 0) {
        const tag_texts = card.tags.map((t) => `#${typeof t === 'string' ? t : t.text}`).join(' ');
        lines.push(`**Tags:** \`${tag_texts}\``);
        lines.push('');
      }
      break;

    case 'quote':
      lines.push(`${h_prefix} 💬 ${card_title || 'Quote'}`);
      lines.push(`> "${card.content || ''}"`);
      if (card.author) {
        lines.push(`> — **${card.author}**`);
      }
      lines.push('');
      break;

    case 'image':
      lines.push(`${h_prefix} 🖼️ ${card_title || 'Visual Study'}`);
      if (card.caption) {
        lines.push(`*${card.caption}*`);
      }
      if (card.imageUrl) {
        lines.push(`![${card_title || 'Image'}](${card.imageUrl})`);
      }
      if (Array.isArray(card.images) && card.images.length > 1) {
        lines.push('**Image Carousel Gallery:**');
        card.images.forEach((img, i) => {
          lines.push(`${i + 1}. [Slide ${i + 1}](${img.url}) — *${img.caption || 'Slide'}*`);
        });
      }
      lines.push('');
      break;

    case 'palette':
      lines.push(`${h_prefix} 🎨 ${card_title || 'Color Palette'}`);
      if (Array.isArray(card.colors) && card.colors.length > 0) {
        card.colors.forEach((c) => {
          lines.push(`- **${c.name || 'Color'}**: \`${c.hex || '#000000'}\``);
        });
        lines.push('');
      }
      break;

    case 'sheets':
      lines.push(`${h_prefix} 📊 ${card_title || 'Spreadsheet Data'}`);
      if (card.sheets_data && Array.isArray(card.sheets_data.rows)) {
        const headers = card.sheets_data.headers || [];
        if (headers.length > 0) {
          lines.push(`| ${headers.join(' | ')} |`);
          lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
          card.sheets_data.rows.forEach((row) => {
            lines.push(`| ${row.join(' | ')} |`);
          });
          lines.push('');
        }
      }
      break;

    case 'docs':
      lines.push(`${h_prefix} 📄 ${card_title || 'Document'}`);
      if (card.doc_content) {
        lines.push(card.doc_content);
        lines.push('');
      }
      break;

    case 'stock':
      lines.push(`${h_prefix} 📈 Stock: ${card.symbol || 'QUOTE'}`);
      lines.push(`**${card.companyName || card.symbol}**`);
      lines.push(`- Current Price: **$${card.price || '0.00'}**`);
      lines.push(`- Change: **${card.change || '0'} (${card.changePercent || '0%'})**`);
      lines.push('');
      break;

    case 'geo':
      lines.push(`${h_prefix} 📍 Location: ${card_title || 'Place'}`);
      if (card.locationName) lines.push(`**Place:** ${card.locationName}`);
      if (card.address) lines.push(`**Address:** ${card.address}`);
      if (card.notes) lines.push(`**Notes:** ${card.notes}`);
      lines.push('');
      break;

    case 'file':
      lines.push(`${h_prefix} 📎 File Attachment: ${card.fileName || card_title || 'File'}`);
      if (card.fileSize) lines.push(`- Size: ${card.fileSize}`);
      if (card.fileType) lines.push(`- Type: ${card.fileType}`);
      if (card.fileUrl) lines.push(`- [Download Attached File](${card.fileUrl})`);
      lines.push('');
      break;

    case 'link':
    case 'embed':
      lines.push(`${h_prefix} 🔗 Link: [${card_title || card.url || 'Web Resource'}](${card.url || '#'})`);
      if (card.description) lines.push(`> ${card.description}`);
      lines.push('');
      break;

    default:
      if (card_title) {
        lines.push(`${h_prefix} ${card_title}`);
        if (card.content) lines.push(card.content);
        lines.push('');
      }
      break;
  }
};

// ============================================================================
// 2. PLAIN TEXT EXPORT
// ============================================================================
export const generate_board_plain_text = (board) => {
  if (!board) return '';
  const lines = [];

  const title = (board.title || 'UNTITLED BOARD').toUpperCase();
  const description = board.description || '';
  const divider = '='.repeat(72);
  const sub_divider = '-'.repeat(72);

  lines.push(divider);
  lines.push(title);
  lines.push(divider);
  if (description) {
    lines.push(description);
    lines.push('');
  }
  lines.push(`Exported from Lumen Spatial Workspace · ${new Date().toLocaleString()}`);
  lines.push('');

  const cards = board.cards || [];

  // Groups
  const groups = cards.filter((c) => c.type === 'group');
  const grouped_card_ids = new Set();
  groups.forEach((g) => {
    (g.card_ids || []).forEach((id) => grouped_card_ids.add(id));
  });

  groups.forEach((group) => {
    lines.push(sub_divider);
    lines.push(`[GROUP CONTAINER] ${group.title || 'Untitled Group'}`);
    if (group.description) lines.push(`Description: ${group.description}`);
    lines.push(sub_divider);
    lines.push('');

    const members = (group.card_ids || [])
      .map((id) => cards.find((c) => c.id === id))
      .filter(Boolean);

    members.forEach((card) => {
      render_card_plain_text(card, lines);
    });
    lines.push('');
  });

  // Ungrouped
  const ungrouped = cards
    .filter((c) => c.type !== 'group' && !grouped_card_ids.has(c.id))
    .sort((a, b) => (a.y === b.y ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0)));

  ungrouped.forEach((card) => {
    render_card_plain_text(card, lines);
  });

  return lines.join('\n');
};

const render_card_plain_text = (card, lines) => {
  const title = card.title || 'Card';
  switch (card.type) {
    case 'heading':
      lines.push(`--- SECTION: ${title} ---`);
      if (card.content) lines.push(card.content);
      lines.push('');
      break;

    case 'note':
      lines.push(`[NOTE] ${title}`);
      if (card.content) lines.push(card.content);
      if (card.ai_notes) lines.push(`  AI Note: ${card.ai_notes}`);
      if (card.tags && card.tags.length > 0) {
        lines.push(`  Tags: ${card.tags.map((t) => `#${typeof t === 'string' ? t : t.text}`).join(', ')}`);
      }
      lines.push('');
      break;

    case 'tasklist':
      lines.push(`[CHECKLIST] ${title}`);
      if (Array.isArray(card.items)) {
        card.items.forEach((item) => {
          lines.push(`  ${item.done ? '[X]' : '[ ]'} ${item.text}`);
        });
      }
      lines.push('');
      break;

    case 'quote':
      lines.push(`[QUOTE] "${card.content || ''}"`);
      if (card.author) lines.push(`  — ${card.author}`);
      lines.push('');
      break;

    case 'image':
      lines.push(`[IMAGE] ${title}`);
      if (card.caption) lines.push(`  Caption: ${card.caption}`);
      if (card.imageUrl) lines.push(`  URL: ${card.imageUrl}`);
      lines.push('');
      break;

    case 'palette':
      lines.push(`[COLOR PALETTE] ${title}`);
      if (Array.isArray(card.colors)) {
        card.colors.forEach((c) => {
          lines.push(`  • ${c.name || 'Color'}: ${c.hex}`);
        });
      }
      lines.push('');
      break;

    case 'stock':
      lines.push(`[STOCK] ${card.symbol} (${card.companyName || ''}): $${card.price || '0.00'} [${card.change || ''}]`);
      lines.push('');
      break;

    case 'geo':
      lines.push(`[LOCATION] ${title} (${card.locationName || ''})`);
      if (card.address) lines.push(`  Address: ${card.address}`);
      if (card.notes) lines.push(`  Notes: ${card.notes}`);
      lines.push('');
      break;

    case 'file':
      lines.push(`[ATTACHED FILE] ${card.fileName || title} (${card.fileSize || ''})`);
      lines.push('');
      break;

    default:
      lines.push(`[${(card.type || 'ITEM').toUpperCase()}] ${title}`);
      if (card.content) lines.push(card.content);
      lines.push('');
      break;
  }
};

// ============================================================================
// 3. MICROSOFT WORD (.DOCX) EXPORT (WordprocessingML via JSZip)
// ============================================================================
export const generate_board_docx_blob = async (board) => {
  const zip = new JSZip();

  const title = board.title || 'Lumen Board Document';
  const description = board.description || '';
  const date_str = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // 1. Content Types XML
  const content_types_xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  // 2. _rels/.rels
  const rels_xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  // 3. word/styles.xml
  const styles_xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/package/2006/wordprocessingml">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="160"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

  // 4. word/document.xml
  const body_xml_parts = [];

  // Title
  body_xml_parts.push(`
    <w:p>
      <w:pPr>
        <w:spacing w:before="120" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="52"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>${escape_xml(title)}</w:t>
      </w:r>
    </w:p>
  `);

  // Subtitle / Description
  if (description) {
    body_xml_parts.push(`
      <w:p>
        <w:pPr>
          <w:spacing w:after="180"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:i/>
            <w:sz w:val="24"/>
            <w:color w:val="475569"/>
          </w:rPr>
          <w:t>${escape_xml(description)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  // Meta line
  body_xml_parts.push(`
    <w:p>
      <w:pPr>
        <w:spacing w:after="360"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="12" w:space="12" w:color="CBD5E1"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:color w:val="64748B"/>
        </w:rPr>
        <w:t>Generated with Lumen Spatial Workspace · ${escape_xml(date_str)} · ${(board.cards || []).length} items</w:t>
      </w:r>
    </w:p>
  `);

  const cards = board.cards || [];
  const groups = cards.filter((c) => c.type === 'group');
  const grouped_card_ids = new Set();
  groups.forEach((g) => {
    (g.card_ids || []).forEach((id) => grouped_card_ids.add(id));
  });

  // Render Groups
  groups.forEach((group) => {
    body_xml_parts.push(`
      <w:p>
        <w:pPr>
          <w:spacing w:before="360" w:after="80"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="34"/>
            <w:color w:val="2563EB"/>
          </w:rPr>
          <w:t>📂 ${escape_xml(group.title || 'Untitled Group')}</w:t>
        </w:r>
      </w:p>
    `);
    if (group.description) {
      body_xml_parts.push(`
        <w:p>
          <w:pPr><w:spacing w:after="180"/></w:pPr>
          <w:r>
            <w:rPr><w:i/><w:color w:val="64748B"/></w:rPr>
            <w:t>${escape_xml(group.description)}</w:t>
          </w:r>
        </w:p>
      `);
    }

    const members = (group.card_ids || [])
      .map((id) => cards.find((c) => c.id === id))
      .filter(Boolean);

    members.forEach((card) => {
      body_xml_parts.push(render_card_docx_xml(card));
    });
  });

  // Render Ungrouped
  const ungrouped = cards
    .filter((c) => c.type !== 'group' && !grouped_card_ids.has(c.id))
    .sort((a, b) => (a.y === b.y ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0)));

  ungrouped.forEach((card) => {
    body_xml_parts.push(render_card_docx_xml(card));
  });

  const document_xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/package/2006/wordprocessingml">
  <w:body>
    ${body_xml_parts.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('[Content_Types].xml', content_types_xml);
  zip.file('_rels/.rels', rels_xml);
  zip.file('word/styles.xml', styles_xml);
  zip.file('word/document.xml', document_xml);

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};

const render_card_docx_xml = (card) => {
  const parts = [];
  const title = card.title || '';

  switch (card.type) {
    case 'heading':
      parts.push(`
        <w:p>
          <w:pPr><w:spacing w:before="300" w:after="80"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="0F172A"/></w:rPr>
            <w:t>${escape_xml(title)}</w:t>
          </w:r>
        </w:p>
      `);
      if (card.content) {
        parts.push(`
          <w:p>
            <w:pPr><w:spacing w:after="160"/></w:pPr>
            <w:r><w:t>${escape_xml(card.content)}</w:t></w:r>
          </w:p>
        `);
      }
      break;

    case 'note':
      parts.push(`
        <w:p>
          <w:pPr><w:spacing w:before="240" w:after="60"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="1E293B"/></w:rPr>
            <w:t>📝 ${escape_xml(title || 'Note')}</w:t>
          </w:r>
        </w:p>
      `);
      if (card.content) {
        const lines = card.content.split('\n');
        lines.forEach((line) => {
          parts.push(`
            <w:p>
              <w:pPr><w:spacing w:after="80"/><w:ind w:left="240"/></w:pPr>
              <w:r><w:t>${escape_xml(line)}</w:t></w:r>
            </w:p>
          `);
        });
      }
      if (card.tags && card.tags.length > 0) {
        const tag_str = card.tags.map((t) => `#${typeof t === 'string' ? t : t.text}`).join('  ');
        parts.push(`
          <w:p>
            <w:pPr><w:spacing w:after="140"/><w:ind w:left="240"/></w:pPr>
            <w:r>
              <w:rPr><w:sz w:val="18"/><w:color w:val="6366F1"/></w:rPr>
              <w:t>Tags: ${escape_xml(tag_str)}</w:t>
            </w:r>
          </w:p>
        `);
      }
      break;

    case 'tasklist':
      parts.push(`
        <w:p>
          <w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="26"/><w:color w:val="1E293B"/></w:rPr>
            <w:t>☑️ ${escape_xml(title || 'Checklist')}</w:t>
          </w:r>
        </w:p>
      `);
      if (Array.isArray(card.items)) {
        card.items.forEach((item) => {
          parts.push(`
            <w:p>
              <w:pPr><w:spacing w:after="60"/><w:ind w:left="360"/></w:pPr>
              <w:r>
                <w:rPr>
                  <w:b/>
                  <w:color w:val="${item.done ? '16A34A' : '64748B'}"/>
                </w:rPr>
                <w:t xml:space="preserve">${item.done ? '☑ [Done] ' : '☐ [Open] '}</w:t>
              </w:r>
              <w:r>
                <w:rPr>
                  ${item.done ? '<w:strike/>' : ''}
                  <w:color w:val="${item.done ? '64748B' : '1E293B'}"/>
                </w:rPr>
                <w:t>${escape_xml(item.text)}</w:t>
              </w:r>
            </w:p>
          `);
        });
      }
      break;

    case 'quote':
      parts.push(`
        <w:p>
          <w:pPr>
            <w:spacing w:before="200" w:after="60"/>
            <w:ind w:left="480"/>
            <w:pBdr>
              <w:left w:val="single" w:sz="18" w:space="8" w:color="3B82F6"/>
            </w:pBdr>
          </w:pPr>
          <w:r>
            <w:rPr><w:i/><w:sz w:val="24"/><w:color w:val="334155"/></w:rPr>
            <w:t>“${escape_xml(card.content || '')}”</w:t>
          </w:r>
        </w:p>
      `);
      if (card.author) {
        parts.push(`
          <w:p>
            <w:pPr><w:spacing w:after="160"/><w:ind w:left="480"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr>
              <w:t>— ${escape_xml(card.author)}</w:t>
            </w:r>
          </w:p>
        `);
      }
      break;

    case 'image':
      parts.push(`
        <w:p>
          <w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E293B"/></w:rPr>
            <w:t>🖼️ ${escape_xml(title || 'Visual Study')}</w:t>
          </w:r>
        </w:p>
      `);
      if (card.caption) {
        parts.push(`
          <w:p>
            <w:pPr><w:spacing w:after="140"/><w:ind w:left="240"/></w:pPr>
            <w:r>
              <w:rPr><w:i/><w:color w:val="64748B"/></w:rPr>
              <w:t>${escape_xml(card.caption)}</w:t>
            </w:r>
          </w:p>
        `);
      }
      break;

    case 'palette':
      parts.push(`
        <w:p>
          <w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="1E293B"/></w:rPr>
            <w:t>🎨 ${escape_xml(title || 'Color Swatches')}</w:t>
          </w:r>
        </w:p>
      `);
      if (Array.isArray(card.colors)) {
        card.colors.forEach((c) => {
          parts.push(`
            <w:p>
              <w:pPr><w:spacing w:after="40"/><w:ind w:left="240"/></w:pPr>
              <w:r>
                <w:rPr><w:b/></w:rPr>
                <w:t>${escape_xml(c.name || 'Swatch')}: </w:t>
              </w:r>
              <w:r>
                <w:rPr><w:color w:val="2563EB"/></w:rPr>
                <w:t>${escape_xml(c.hex || '')}</w:t>
              </w:r>
            </w:p>
          `);
        });
      }
      break;

    default:
      if (title) {
        parts.push(`
          <w:p>
            <w:pPr><w:spacing w:before="180" w:after="60"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
              <w:t>${escape_xml(title)}</w:t>
            </w:r>
          </w:p>
        `);
        if (card.content) {
          parts.push(`
            <w:p>
              <w:pPr><w:spacing w:after="140"/><w:ind w:left="240"/></w:pPr>
              <w:r><w:t>${escape_xml(card.content)}</w:t></w:r>
            </w:p>
          `);
        }
      }
      break;
  }

  return parts.join('\n');
};

// ============================================================================
// 4. DOWNLOAD ALL IMAGES & FILES (ZIP ARCHIVE via JSZip)
// ============================================================================
export const export_board_assets_zip = async (board, on_progress) => {
  const assets = get_board_asset_list(board);
  if (assets.length === 0) {
    throw new Error('No images or uploaded files found on this board.');
  }

  const zip = new JSZip();
  const img_folder = zip.folder('images');
  const file_folder = zip.folder('files');

  const manifest_lines = [
    `LUMEN SPATIAL BOARD ASSETS ARCHIVE`,
    `Board: ${board.title || 'Untitled Board'}`,
    `Exported: ${new Date().toISOString()}`,
    `Total Assets: ${assets.length}`,
    `----------------------------------------`,
  ];

  let completed = 0;

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    if (on_progress) {
      on_progress({ current: i + 1, total: assets.length, name: asset.name });
    }

    try {
      let blob_data = null;

      // Handle Data URL (base64)
      if (asset.url.startsWith('data:')) {
        const res = await fetch(asset.url);
        blob_data = await res.blob();
      } else {
        // Fetch local or remote asset
        try {
          const res = await fetch(asset.url);
          if (res.ok) {
            blob_data = await res.blob();
          }
        } catch {
          // If fetch fails (e.g. CORS), attempt image loading into canvas to extract blob
          blob_data = await load_image_as_blob_fallback(asset.url);
        }
      }

      if (blob_data) {
        if (asset.type === 'image') {
          img_folder.file(asset.name, blob_data);
          manifest_lines.push(`[IMAGE] images/${asset.name} - ${asset.card_title} ${asset.caption ? `(${asset.caption})` : ''}`);
        } else {
          file_folder.file(asset.name, blob_data);
          manifest_lines.push(`[FILE]  files/${asset.name} - ${asset.card_title}`);
        }
        completed++;
      } else {
        manifest_lines.push(`[FAILED] ${asset.name} - Could not retrieve source`);
      }
    } catch {
      manifest_lines.push(`[ERROR] ${asset.name}`);
    }
  }

  manifest_lines.push(`----------------------------------------`);
  manifest_lines.push(`Successfully packaged: ${completed} / ${assets.length} files`);
  zip.file('README_assets.txt', manifest_lines.join('\n'));

  // Also include the markdown linear document for completeness
  zip.file('board_summary.md', generate_board_markdown(board));

  return zip.generateAsync({ type: 'blob' });
};

// Fallback to load image through standard <img> element to convert to blob
const load_image_as_blob_fallback = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 400;
        canvas.height = img.naturalHeight || img.height || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

// ============================================================================
// 5. BOARD LAYOUT CANVAS CAPTURE (PNG & PDF)
// ============================================================================

// Helper to capture board layout without cropping any cards
export const capture_board_canvas = async (board, options = {}) => {
  const {
    scope = 'full', // 'full' (all cards bounds) or 'visible'
    scale = 2,
    include_background = true,
  } = options;

  const cards = board?.cards || [];
  if (cards.length === 0) {
    throw new Error('The board has no cards to capture.');
  }

  // Find canvas DOM element
  const canvas_container =
    document.getElementById('lumen-canvas-main') ||
    document.querySelector('[data-lumen-canvas="true"]') ||
    document.querySelector('[class*="lumenCanvasContainer"]') ||
    document.body;

  const viewport_el = canvas_container.querySelector('[class*="lumenViewport"]');

  if (!viewport_el) {
    throw new Error('Canvas viewport element not found in DOM.');
  }

  // Calculate comprehensive bounding box across ALL cards and drawings
  const padding = 96;
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;

  cards.forEach((c) => {
    const cx = typeof c.x === 'number' ? c.x : 0;
    const cy = typeof c.y === 'number' ? c.y : 0;
    const cw = typeof c.width === 'number' ? c.width : 340;
    const ch = typeof c.height === 'number' ? c.height : (
      c.type === 'docs' ? 560 :
      c.type === 'sheets' ? 380 :
      c.type === 'canvas' ? 440 :
      c.type === 'stock' ? 380 :
      c.type === 'embed' || c.type === 'social' ? 520 :
      c.type === 'geo' ? 420 :
      c.type === 'palette' ? 256 :
      c.type === 'group' ? 400 : 260
    );
    min_x = Math.min(min_x, cx);
    min_y = Math.min(min_y, cy);
    max_x = Math.max(max_x, cx + cw);
    max_y = Math.max(max_y, cy + ch);
  });

  if (Array.isArray(board.drawings)) {
    board.drawings.forEach((stroke) => {
      (stroke.points || []).forEach((pt) => {
        if (typeof pt.x === 'number' && Math.abs(pt.x) < 20000) {
          min_x = Math.min(min_x, pt.x);
          max_x = Math.max(max_x, pt.x);
        }
        if (typeof pt.y === 'number' && Math.abs(pt.y) < 20000) {
          min_y = Math.min(min_y, pt.y);
          max_y = Math.max(max_y, pt.y);
        }
      });
    });
  }

  if (!isFinite(min_x)) min_x = 0;
  if (!isFinite(min_y)) min_y = 0;
  if (!isFinite(max_x)) max_x = 1200;
  if (!isFinite(max_y)) max_y = 800;

  const board_w = Math.max(1200, Math.ceil(max_x - min_x + padding * 2));
  const board_h = Math.max(800, Math.ceil(max_y - min_y + padding * 2));
  const shift_x = -min_x + padding;
  const shift_y = -min_y + padding;

  // Background color
  const bg_color = include_background ? '#090d16' : '#ffffff';

  if (scope === 'visible') {
    return html2canvas(canvas_container, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: bg_color,
      ignoreElements: (el) => {
        return (
          el.classList?.contains?.('lumenCanvasStatusBadge') ||
          el.classList?.contains?.('lumenDrawingToolbar') ||
          el.classList?.contains?.('lumenMultiSelectBar') ||
          el.classList?.contains?.('lumenCollaboratorCursor')
        );
      },
    });
  }

  // Full Board Layout capture:
  // Render html2canvas from document.body with isolated stage so ZERO cards get cropped by viewport offsets or transforms
  return html2canvas(document.body, {
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: bg_color,
    width: board_w,
    height: board_h,
    windowWidth: board_w,
    windowHeight: board_h,
    scrollX: 0,
    scrollY: 0,
    x: 0,
    y: 0,
    onclone: (cloned_doc) => {
      const cloned_viewport =
        cloned_doc.querySelector('[class*="lumenViewport"]') ||
        cloned_doc.getElementById('lumen-canvas-main');

      if (!cloned_viewport) return;

      // 1. Create a pristine dedicated stage matching exact board dimensions
      const stage = cloned_doc.createElement('div');
      stage.style.position = 'relative';
      stage.style.left = '0';
      stage.style.top = '0';
      stage.style.width = `${board_w}px`;
      stage.style.height = `${board_h}px`;
      stage.style.minWidth = `${board_w}px`;
      stage.style.minHeight = `${board_h}px`;
      stage.style.backgroundColor = bg_color;
      stage.style.overflow = 'hidden';
      stage.style.margin = '0';
      stage.style.padding = '0';
      stage.style.boxSizing = 'border-box';

      // 2. Create inner positioned content wrapper offset by shift_x, shift_y
      const inner = cloned_doc.createElement('div');
      inner.style.position = 'absolute';
      inner.style.left = `${shift_x}px`;
      inner.style.top = `${shift_y}px`;
      inner.style.width = `${max_x + padding * 2}px`;
      inner.style.height = `${max_y + padding * 2}px`;
      inner.style.transform = 'none';
      inner.style.margin = '0';
      inner.style.padding = '0';

      // Move children from cloned_viewport into inner
      while (cloned_viewport.firstChild) {
        inner.appendChild(cloned_viewport.firstChild);
      }

      // 3. Hide non-board UI chrome inside inner
      const hide_selectors = [
        'header',
        'aside',
        '[class*="lumenModal"]',
        '[class*="lumenExportModal"]',
        '[class*="lumenShareModal"]',
        '[class*="lumenDock"]',
        '[class*="lumenMinimap"]',
        '[class*="lumenToast"]',
        '[class*="lumenDrawer"]',
        '[class*="lumenCanvasStatusBadge"]',
        '[class*="lumenDrawingToolbar"]',
        '[class*="lumenDrawingSurface"]',
        '[class*="lumenMultiSelectBar"]',
        '[class*="lumenCollaboratorCursor"]',
        '[class*="lumenDropGhost"]',
        '[class*="lumenSelectionMarquee"]',
        '[class*="lumenActiveTagFilterBanner"]',
        '[class*="lumenCardAiBadge"]',
        '[class*="lumenCardCollaboratorBadge"]',
        '[class*="lumenQuickAdd"]',
        '[class*="lumenCanvasActions"]',
        '[class*="lumenBoardSwitcher"]',
        '[class*="lumenEmptyHint"]',
      ];
      hide_selectors.forEach((sel) => {
        inner.querySelectorAll(sel).forEach((el) => {
          el.style.display = 'none';
        });
      });

      // 4. Normalize SVG drawing layer to prevent huge negative coordinates
      const drawingSvg = inner.querySelector('[class*="lumen-drawing-layer-svg"]');
      if (drawingSvg) {
        drawingSvg.style.position = 'absolute';
        drawingSvg.style.top = '0';
        drawingSvg.style.left = '0';
        drawingSvg.style.width = '100%';
        drawingSvg.style.height = '100%';
        const g = drawingSvg.querySelector('g');
        if (g) g.removeAttribute('transform');
      }

      // 5. Reset card outlines, transitions, and hover effects
      inner.querySelectorAll('[class*="lumenCard"]').forEach((cardEl) => {
        cardEl.style.transition = 'none';
        cardEl.style.outline = 'none';
        cardEl.style.boxSizing = 'border-box';
      });

      stage.appendChild(inner);

      // 6. Replace body contents cleanly with only stage
      cloned_doc.body.innerHTML = '';
      cloned_doc.body.style.margin = '0';
      cloned_doc.body.style.padding = '0';
      cloned_doc.body.style.overflow = 'hidden';
      cloned_doc.body.style.width = `${board_w}px`;
      cloned_doc.body.style.height = `${board_h}px`;
      cloned_doc.body.style.backgroundColor = bg_color;
      cloned_doc.body.appendChild(stage);

      cloned_doc.documentElement.style.margin = '0';
      cloned_doc.documentElement.style.padding = '0';
      cloned_doc.documentElement.style.overflow = 'hidden';
      cloned_doc.documentElement.style.width = `${board_w}px`;
      cloned_doc.documentElement.style.height = `${board_h}px`;
      cloned_doc.documentElement.style.backgroundColor = bg_color;
    },
  });
};

// ============================================================================
// 6. EXPORT AS PNG IMAGE
// ============================================================================
export const export_board_as_png = async (board, options = {}) => {
  const canvas = await capture_board_canvas(board, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create PNG blob.'));
          return;
        }
        const file_name = `${sanitize_filename(board.title || 'board_layout')}.png`;
        trigger_download(blob, file_name);
        resolve({ blob, file_name });
      },
      'image/png',
      1.0
    );
  });
};

// ============================================================================
// 7. COMPREHENSIVE EXPORT AS PDF (UNCROPPED CANVAS & FULL DETAILED DOSSIER)
// ============================================================================

// Utility to clean HTML to readable plain text with preserved linebreaks
const strip_html_tags = (html) => {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n### $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Utility to parse hex color to [r, g, b]
const hex_to_rgb = (hex, fallback = [37, 99, 235]) => {
  if (!hex || typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return fallback;
};

export const export_board_as_pdf = async (board, options = {}) => {
  const {
    mode = 'dossier', // 'dossier' (Map + All Info) | 'canvas' (Spatial Map Only) | 'report' (Document Only)
    scope = 'full',
    scale = 2,
    include_background = true,
  } = options;

  const cards = board?.cards || [];
  const title = board.title || 'Untitled Board';
  const description = board.description || '';
  const file_name = `${sanitize_filename(title)}.pdf`;
  const asset_info = get_board_asset_count(board);

  const updated_date = board.updatedAt
    ? new Date(board.updatedAt).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString();

  // 1. Capture visual canvas map unless in 'report' pure document mode
  let canvas_image_data = null;
  let canvas_aspect = 1.6;

  if (mode !== 'report' && cards.length > 0) {
    try {
      const canvas = await capture_board_canvas(board, {
        scope,
        scale,
        include_background,
      });
      canvas_image_data = canvas.toDataURL('image/jpeg', 0.95);
      canvas_aspect = canvas.width / Math.max(1, canvas.height);
    } catch (err) {
      console.warn('Canvas visual capture for PDF skipped or failed:', err);
    }
  }

  // 2. Mode: Spatial Canvas Map Only
  if (mode === 'canvas') {
    const pdf = new jsPDF({
      orientation: canvas_aspect >= 1 ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
    });

    const page_w = pdf.internal.pageSize.getWidth();
    const page_h = pdf.internal.pageSize.getHeight();
    const margin = 36;
    const avail_w = page_w - margin * 2;
    const avail_h = page_h - margin * 2 - 44;

    // Header bar
    pdf.setFillColor(15, 23, 42);
    pdf.rect(0, 0, page_w, 42, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, 26);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${cards.length} Modules · ${updated_date}`, page_w - margin, 26, { align: 'right' });

    // Center and scale image
    let img_w = avail_w;
    let img_h = img_w / canvas_aspect;
    if (img_h > avail_h) {
      img_h = avail_h;
      img_w = img_h * canvas_aspect;
    }
    const img_x = margin + (avail_w - img_w) / 2;
    const img_y = 50 + (avail_h - img_h) / 2;

    if (canvas_image_data) {
      pdf.addImage(canvas_image_data, 'JPEG', img_x, img_y, img_w, img_h, undefined, 'FAST');
    }
    pdf.setDrawColor(203, 213, 225);
    pdf.rect(img_x, img_y, img_w, img_h);

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Exported from Lumen Spatial Workspace · Full Board Map', margin, page_h - 14);

    pdf.save(file_name);
    return { file_name };
  }

  // 3. Mode: Full Dossier (Visual Map + All Details) or Document Report Only
  // Page 1: Executive Cover & Full Spatial Board Map (in 'dossier' mode)
  const is_dossier = mode === 'dossier';
  const start_orientation = is_dossier ? 'landscape' : 'portrait';

  const pdf = new jsPDF({
    orientation: start_orientation,
    unit: 'pt',
    format: 'a4',
  });

  if (is_dossier) {
    const page1_w = pdf.internal.pageSize.getWidth();
    const page1_h = pdf.internal.pageSize.getHeight();
    const margin = 36;

    // Header banner
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, page1_w, 54, 'F');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(56, 189, 248); // sky-400
    pdf.text('LUMEN SPATIAL WORKSPACE · EXECUTIVE DOSSIER', margin, 20);

    pdf.setFontSize(14);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title, margin, 40);

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184);
    pdf.text(
      `${cards.length} Total Modules  ·  ${asset_info.total_count} Assets  ·  ${updated_date}`,
      page1_w - margin,
      40,
      { align: 'right' }
    );

    // Subtitle
    if (description) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(71, 85, 105);
      pdf.text(description, margin, 70);
    }

    // Embed full canvas map image
    const map_top = description ? 84 : 66;
    const avail_w = page1_w - margin * 2;
    const avail_h = page1_h - map_top - 36;

    let img_w = avail_w;
    let img_h = img_w / canvas_aspect;
    if (img_h > avail_h) {
      img_h = avail_h;
      img_w = img_h * canvas_aspect;
    }
    const img_x = margin + (avail_w - img_w) / 2;
    const img_y = map_top + (avail_h - img_h) / 2;

    if (canvas_image_data) {
      pdf.addImage(canvas_image_data, 'JPEG', img_x, img_y, img_w, img_h, undefined, 'FAST');
      pdf.setDrawColor(203, 213, 225);
      pdf.rect(img_x, img_y, img_w, img_h);
    }

    // Footnote
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      'Full visual spatial board map showing all modules, relative positions, and connector paths. Complete details follow on subsequent pages.',
      margin,
      page1_h - 14
    );
  }

  // Multi-Page Detailed Document Breakdown (Zero Info Missing)
  // Each page is a clean portrait A4 document
  if (is_dossier) {
    pdf.addPage('a4', 'portrait');
  }

  const p_w = 595.28;
  const p_h = 841.89;
  const margin_x = 40;
  const content_w = p_w - margin_x * 2; // ~515 pt
  let cursor_y = 52;

  const draw_running_header = () => {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(100, 116, 139);
    pdf.text('LUMEN SPATIAL WORKSPACE · COMPLETE MODULE DOSSIER', margin_x, 28);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184);
    pdf.text(title, p_w - margin_x, 28, { align: 'right' });
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.75);
    pdf.line(margin_x, 34, p_w - margin_x, 34);
  };

  const ensure_space = (needed_pts) => {
    if (cursor_y + needed_pts > p_h - 48) {
      pdf.addPage('a4', 'portrait');
      draw_running_header();
      cursor_y = 50;
    }
  };

  draw_running_header();

  // If report mode, render cover header on page 1
  if (!is_dossier) {
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(title, margin_x, cursor_y + 16);
    cursor_y += 30;

    if (description) {
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(71, 85, 105);
      const desc_lines = pdf.splitTextToSize(description, content_w);
      pdf.text(desc_lines, margin_x, cursor_y);
      cursor_y += desc_lines.length * 13 + 6;
    }

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Total Modules: ${cards.length}  ·  Assets: ${asset_info.total_count}  ·  Export Date: ${updated_date}`, margin_x, cursor_y);
    cursor_y += 18;

    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin_x, cursor_y, p_w - margin_x, cursor_y);
    cursor_y += 20;
  }

  // Group cards vs ungrouped cards
  const groups = cards.filter((c) => c.type === 'group');
  const grouped_card_ids = new Set();
  groups.forEach((g) => {
    (g.card_ids || []).forEach((id) => grouped_card_ids.add(id));
  });

  // Render Card Detail Helper
  const render_card_pdf_detail = (card, indent = 0) => {
    const card_x = margin_x + indent;
    const card_w = content_w - indent;

    ensure_space(42);

    // Card Type Label & Title
    const card_type = (card.type || 'module').toUpperCase();
    const card_title = card.title || card.fileName || 'Untitled Module';

    // Type Badge Pill
    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.roundedRect(card_x, cursor_y, 56, 14, 2, 2, 'F');
    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(card_type, card_x + 6, cursor_y + 10);

    // Title
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    const title_fit = pdf.splitTextToSize(card_title, card_w - 70);
    pdf.text(title_fit[0] || card_title, card_x + 64, cursor_y + 11);
    cursor_y += 20;

    // Tags & Badges
    if (Array.isArray(card.tags) && card.tags.length > 0) {
      ensure_space(14);
      const tag_str = card.tags.map((t) => `#${typeof t === 'string' ? t : t.text}`).join('   ');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(99, 102, 241); // indigo-500
      pdf.text(tag_str, card_x, cursor_y);
      cursor_y += 13;
    }

    // Reactions
    if (Array.isArray(card.reactions) && card.reactions.length > 0) {
      ensure_space(14);
      const rx_str = card.reactions.map((r) => `${r.emoji} ${r.count}`).join('   ');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Reactions: ${rx_str}`, card_x, cursor_y);
      cursor_y += 12;
    }

    // Specific Type Details
    switch (card.type) {
      // 1. HEADINGS & SECTION MARKERS
      case 'heading': {
        ensure_space(28);
        pdf.setDrawColor(37, 99, 235);
        pdf.setLineWidth(2);
        pdf.line(card_x, cursor_y, card_x + 32, cursor_y);
        cursor_y += 8;

        if (card.content) {
          ensure_space(18);
          pdf.setFontSize(9.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(71, 85, 105);
          const head_lines = pdf.splitTextToSize(card.content, card_w);
          head_lines.forEach((hl) => {
            ensure_space(13);
            pdf.text(hl, card_x, cursor_y);
            cursor_y += 13;
          });
          cursor_y += 4;
        }
        break;
      }

      // 2. NOTES
      case 'note': {
        if (card.content) {
          ensure_space(20);
          pdf.setFontSize(9.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(30, 41, 59);
          const lines = pdf.splitTextToSize(card.content, card_w);
          lines.forEach((line) => {
            ensure_space(13);
            pdf.text(line, card_x, cursor_y);
            cursor_y += 13;
          });
          cursor_y += 4;
        }

        if (card.ai_notes) {
          ensure_space(32);
          pdf.setFillColor(254, 252, 232); // yellow-50
          pdf.setDrawColor(234, 179, 8); // yellow-500
          const ai_lines = pdf.splitTextToSize(`💡 AI Insight: ${card.ai_notes}`, card_w - 18);
          const box_h = ai_lines.length * 12 + 10;
          pdf.rect(card_x, cursor_y, card_w, box_h, 'F');
          pdf.rect(card_x, cursor_y, 3, box_h, 'FD');
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(113, 63, 18);
          ai_lines.forEach((line, idx) => {
            pdf.text(line, card_x + 10, cursor_y + 11 + idx * 12);
          });
          cursor_y += box_h + 8;
        }
        break;
      }

      // 3. CHECKLISTS / TASKS
      case 'tasklist': {
        const items = card.items || [];
        const done_count = items.filter((i) => i.done).length;
        const total = items.length;
        const pct = total > 0 ? Math.round((done_count / total) * 100) : 0;

        ensure_space(18);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(16, 185, 129);
        pdf.text(`Progress: ${done_count} of ${total} tasks completed (${pct}%)`, card_x, cursor_y);
        cursor_y += 14;

        items.forEach((item) => {
          ensure_space(14);
          pdf.setFontSize(9);
          if (item.done) {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(`[✓]  ${item.text}`, card_x + 8, cursor_y);
          } else {
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(15, 23, 42);
            pdf.text(`[  ]  ${item.text}`, card_x + 8, cursor_y);
          }
          cursor_y += 13;
        });

        if (card.ai_notes) {
          ensure_space(24);
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(113, 63, 18);
          pdf.text(`💡 AI Note: ${card.ai_notes}`, card_x + 8, cursor_y);
          cursor_y += 14;
        }
        cursor_y += 6;
        break;
      }

      // 4. SPREADSHEETS / FINANCIAL MODELS
      case 'sheets': {
        ensure_space(20);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(71, 85, 105);
        pdf.text('Tabular Spreadsheet Data & Financial Model:', card_x, cursor_y);
        cursor_y += 12;

        const sheet_data = card.sheets_data || DEFAULT_INITIAL_SHEET;
        const cols = sheet_data.cols || ['A', 'B', 'C', 'D', 'E', 'F'];
        const rows_count = sheet_data.rows_count || 8;
        const col_w = card_w / cols.length;

        // Render table rows
        for (let r = 1; r <= Math.min(rows_count, 12); r++) {
          ensure_space(16);
          const is_header = r === 1;
          pdf.setFillColor(
            is_header ? 241 : r % 2 === 0 ? 248 : 255,
            is_header ? 245 : r % 2 === 0 ? 250 : 255,
            is_header ? 249 : r % 2 === 0 ? 252 : 255
          );
          pdf.rect(card_x, cursor_y, card_w, 16, 'F');
          pdf.setDrawColor(226, 232, 240);
          pdf.rect(card_x, cursor_y, card_w, 16, 'D');

          cols.forEach((col, c_idx) => {
            const cell_key = `${col}${r}`;
            const cell = sheet_data.cells ? sheet_data.cells[cell_key] : null;
            let val = '';
            if (cell) {
              if (typeof cell.raw === 'boolean') {
                val = cell.raw ? '[X]' : '[ ]';
              } else {
                val = String(cell.raw || '');
                if (cell.format === 'currency_idr' && !val.startsWith('=')) {
                  val = `Rp ${Number(val).toLocaleString()}`;
                }
              }
            } else if (r === 1) {
              const def_h = ['Done', 'Task / Item', 'Category', 'Qty', 'Unit Cost', 'Total'];
              val = def_h[c_idx] || col;
            }

            pdf.setFontSize(8);
            pdf.setFont('helvetica', is_header ? 'bold' : 'normal');
            pdf.setTextColor(is_header ? 15 : 51, is_header ? 23 : 65, is_header ? 42 : 85);
            pdf.text(val.slice(0, 24), card_x + c_idx * col_w + 4, cursor_y + 11);
          });
          cursor_y += 16;
        }
        cursor_y += 8;
        break;
      }

      // 5. RICH DOCUMENTS & CODE SPECIFICATIONS
      case 'docs': {
        const doc_raw = card.content || card.doc_content || '';
        if (doc_raw) {
          ensure_space(20);

          // Extract code snippet blocks if present
          const code_regex = /<div class="lumen-docs-code-container"[^>]*data-language="([^"]*)"[^>]*>[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/div>/gi;
          let doc_without_code = doc_raw;
          const code_blocks = [];
          let match;

          while ((match = code_regex.exec(doc_raw)) !== null) {
            code_blocks.push({
              lang: match[1] || 'code',
              code: match[2].replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
            });
          }

          // Strip tags from non-code text
          const clean_text = strip_html_tags(doc_without_code.replace(code_regex, '\n[CODE_SNIPPET_BLOCK]\n'));
          const paragraphs = clean_text.split('\n');
          let code_idx = 0;

          paragraphs.forEach((p) => {
            const trimmed = p.trim();
            if (!trimmed) {
              cursor_y += 4;
              return;
            }

            if (trimmed === '[CODE_SNIPPET_BLOCK]' && code_blocks[code_idx]) {
              const snippet = code_blocks[code_idx++];
              const snippet_lines = snippet.code.split('\n');
              const snippet_h = snippet_lines.length * 11 + 24;

              ensure_space(Math.min(snippet_h, 120));

              // Dark Google AI Code Snippet Container
              pdf.setFillColor(30, 31, 32); // #1e1f20
              pdf.roundedRect(card_x, cursor_y, card_w, snippet_h, 4, 4, 'F');
              pdf.setDrawColor(60, 64, 67); // #3c4043
              pdf.roundedRect(card_x, cursor_y, card_w, snippet_h, 4, 4, 'D');

              // Header bar
              pdf.setFillColor(40, 42, 44); // #282a2c
              pdf.rect(card_x, cursor_y, card_w, 18, 'F');
              pdf.setFontSize(7.5);
              pdf.setFont('courier', 'bold');
              pdf.setTextColor(196, 199, 197);
              pdf.text(`CODE SNIPPET · ${snippet.lang.toUpperCase()}`, card_x + 8, cursor_y + 12);
              cursor_y += 22;

              // Code lines
              pdf.setFontSize(8);
              pdf.setFont('courier', 'normal');
              pdf.setTextColor(227, 227, 227);
              snippet_lines.forEach((cline) => {
                ensure_space(12);
                pdf.text(cline.slice(0, 75), card_x + 10, cursor_y);
                cursor_y += 11;
              });
              cursor_y += 8;
            } else if (trimmed.startsWith('###')) {
              ensure_space(18);
              pdf.setFontSize(10.5);
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(15, 23, 42);
              pdf.text(trimmed.replace(/^###\s*/, ''), card_x, cursor_y);
              cursor_y += 15;
            } else if (trimmed.startsWith('•')) {
              ensure_space(13);
              pdf.setFontSize(9);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(51, 65, 85);
              const b_lines = pdf.splitTextToSize(trimmed, card_w - 12);
              b_lines.forEach((bl) => {
                ensure_space(12);
                pdf.text(bl, card_x + 8, cursor_y);
                cursor_y += 12;
              });
            } else {
              ensure_space(13);
              pdf.setFontSize(9);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(30, 41, 59);
              const p_lines = pdf.splitTextToSize(trimmed, card_w);
              p_lines.forEach((pl) => {
                ensure_space(13);
                pdf.text(pl, card_x, cursor_y);
                cursor_y += 13;
              });
            }
          });
        }
        cursor_y += 6;
        break;
      }

      // 6. STOCKS & FINANCIAL TICKERS
      case 'stock': {
        ensure_space(42);
        const sym = card.symbol || 'MAPI.JK';
        const ex = card.exchange || 'IDX - Jakarta';
        const price = card.price || card.current_price || 'Rp 1,050';
        const chg = card.change || '+1.45%';

        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(card_x, cursor_y, card_w, 36, 4, 4, 'FD');

        pdf.setFontSize(9.5);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(15, 23, 42);
        pdf.text(`Ticker: ${sym} (${ex})`, card_x + 10, cursor_y + 14);

        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        pdf.text(
          `Latest Price: ${price}   ·   24h Change: ${chg} (Bullish)   ·   Auto-check: 30s interval   ·   Range: ${card.range || '1d'}`,
          card_x + 10,
          cursor_y + 26
        );

        cursor_y += 44;
        break;
      }

      // 7. COLOR PALETTES & MATERIAL TOKENS
      case 'palette': {
        if (card.description) {
          ensure_space(14);
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Theme: ${card.description}`, card_x, cursor_y);
          cursor_y += 12;
        }

        const swatches = Array.isArray(card.colors) ? card.colors : [];
        if (swatches.length > 0) {
          ensure_space(20);
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(71, 85, 105);
          pdf.text('Design System Color Tokens & Material Swatches:', card_x, cursor_y);
          cursor_y += 14;

          swatches.forEach((sw) => {
            ensure_space(16);
            const rgb = hex_to_rgb(sw.hex);
            pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
            pdf.rect(card_x, cursor_y - 8, 14, 11, 'F');
            pdf.setDrawColor(203, 213, 225);
            pdf.rect(card_x, cursor_y - 8, 14, 11, 'D');

            pdf.setFontSize(8.5);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(15, 23, 42);
            pdf.text(sw.name || 'Swatch', card_x + 20, cursor_y);

            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(`HEX: ${sw.hex || '#000'}   ·   Role: ${sw.role || 'Token'}`, card_x + 140, cursor_y);

            cursor_y += 15;
          });
          cursor_y += 6;
        }
        break;
      }

      // 8. GEO & LOCATIONS ITINERARY
      case 'geo': {
        ensure_space(30);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85);
        if (card.location_name || card.locationName) {
          pdf.text(`Location: ${card.location_name || card.locationName}`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.address) {
          pdf.text(`Primary Address: ${card.address}`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.latitude && card.longitude) {
          pdf.text(`GPS Coordinates: ${card.latitude}, ${card.longitude} (Zoom: ${card.zoom || 15}x)`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.travel_mode) {
          pdf.text(`Travel Mode: ${card.travel_mode}`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.notes) {
          pdf.setFont('helvetica', 'italic');
          pdf.text(`Field Notes: ${card.notes}`, card_x, cursor_y);
          cursor_y += 12;
        }

        // Render full destinations itinerary stops
        if (Array.isArray(card.destinations) && card.destinations.length > 0) {
          ensure_space(18);
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(15, 23, 42);
          pdf.text(`Site Visit Itinerary (${card.destinations.length} stops):`, card_x, cursor_y);
          cursor_y += 13;

          card.destinations.forEach((dest, d_idx) => {
            ensure_space(14);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(71, 85, 105);
            pdf.text(`Stop ${d_idx + 1}: ${dest.name} — ${dest.address}`, card_x + 8, cursor_y);
            cursor_y += 12;
          });
        }
        cursor_y += 6;
        break;
      }

      // 9. QUOTATIONS
      case 'quote': {
        ensure_space(28);
        pdf.setDrawColor(37, 99, 235);
        pdf.rect(card_x, cursor_y, 3, 24, 'F');

        pdf.setFontSize(9.5);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(30, 41, 59);
        const q_lines = pdf.splitTextToSize(`"${card.content || ''}"`, card_w - 14);
        q_lines.forEach((ql) => {
          ensure_space(13);
          pdf.text(ql, card_x + 8, cursor_y + 9);
          cursor_y += 13;
        });

        if (card.author) {
          ensure_space(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(71, 85, 105);
          pdf.text(`— ${card.author}`, card_x + 8, cursor_y + 8);
          cursor_y += 16;
        }
        break;
      }

      // 10. FILES & DIGITAL ATTACHMENTS
      case 'file': {
        ensure_space(24);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85);
        const fname = card.fileName || card.file_name || card.title || 'Attachment';
        const fsize_str =
          typeof card.file_size === 'number'
            ? `${(card.file_size / 1024).toFixed(1)} KB`
            : card.fileSize || '';
        const ftype = card.fileType || card.file_type || '';
        const dl_count = card.download_count || 0;

        pdf.text(`Attached File: ${fname}  ${fsize_str ? `(${fsize_str})` : ''}  ${ftype ? `·  ${ftype}` : ''}  ·  ${dl_count} downloads`, card_x, cursor_y);
        cursor_y += 14;

        const is_3d_file =
          ['glb', 'gltf', 'obj', 'stl', '3ds', 'fbx', 'step', 'dae'].includes(fname.split('.').pop()?.toLowerCase()) ||
          ftype?.toLowerCase().includes('model') ||
          ftype?.toLowerCase().includes('3d') ||
          ftype?.toLowerCase().includes('gltf');
        if (is_3d_file) {
          ensure_space(14);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(2, 132, 199);
          pdf.text('Spatial Asset: Interactive 3D Model with Real-Time Orbit Controls & Shading Viewport', card_x, cursor_y);
          cursor_y += 13;
        }

        if (card.content) {
          ensure_space(14);
          pdf.setFont('helvetica', 'italic');
          pdf.text(`Description: ${card.content}`, card_x, cursor_y);
          cursor_y += 13;
        }
        if (card.ai_notes) {
          ensure_space(14);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(113, 63, 18);
          pdf.text(`💡 AI File Summary: ${card.ai_notes}`, card_x, cursor_y);
          cursor_y += 14;
        }
        cursor_y += 4;
        break;
      }

      // 11. MEDIA EMBEDS & SOCIAL LINKS
      case 'embed':
      case 'social': {
        ensure_space(24);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85);
        if (card.platform) {
          pdf.text(`Platform: ${card.platform.toUpperCase()} (${card.social_type || 'Media'})`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.url) {
          pdf.text(`URL Resource: ${card.url}`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.description || card.content) {
          pdf.setFont('helvetica', 'italic');
          pdf.text(card.description || card.content, card_x, cursor_y);
          cursor_y += 12;
        }
        cursor_y += 4;
        break;
      }

      // 12. IMAGES & MULTI-SLIDE CAROUSELS
      case 'image': {
        ensure_space(20);
        if (card.caption) {
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(71, 85, 105);
          pdf.text(`Caption: ${card.caption}`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (Array.isArray(card.images) && card.images.length > 0) {
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(15, 23, 42);
          pdf.text(`Multi-Slide Carousel (${card.images.length} images included in board assets):`, card_x, cursor_y);
          cursor_y += 13;

          card.images.forEach((img, idx) => {
            ensure_space(13);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(100, 116, 139);
            pdf.text(`Slide ${idx + 1}: ${img.caption || 'Visual asset study'}`, card_x + 8, cursor_y);
            cursor_y += 12;
          });
        }
        cursor_y += 4;
        break;
      }

      // 13. NESTED SUB-BOARDS
      case 'board': {
        ensure_space(24);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85);
        if (card.description) {
          pdf.text(`Workspace Description: ${card.description}`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.target_board_id) {
          pdf.text(`Target Sub-Board ID: ${card.target_board_id} (Nested child canvas)`, card_x, cursor_y);
          cursor_y += 12;
        }
        cursor_y += 4;
        break;
      }

      // 14. KANBAN / PRINCIPLE COLUMNS
      case 'column': {
        if (card.content) {
          ensure_space(20);
          pdf.setFontSize(8.5);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(71, 85, 105);
          pdf.text('Staged Column Steps & Principles:', card_x, cursor_y);
          cursor_y += 12;

          const col_steps = card.content.split('\n');
          col_steps.forEach((step) => {
            const trimmed = step.trim();
            if (!trimmed) return;
            ensure_space(13);
            pdf.setFontSize(8.5);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(30, 41, 59);
            pdf.text(`• ${trimmed}`, card_x + 8, cursor_y);
            cursor_y += 12;
          });
        }
        cursor_y += 4;
        break;
      }

      // 15. FREEHAND CANVAS SKETCHING
      case 'canvas': {
        ensure_space(20);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85);
        pdf.text('Interactive Freehand Canvas Sketch & Spatial Mood Collage', card_x, cursor_y);
        cursor_y += 14;
        break;
      }

      // 16. LINKS & BOOKMARKS
      case 'link': {
        ensure_space(22);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(51, 65, 85);
        if (card.url) {
          pdf.text(`Target URL: ${card.url}`, card_x, cursor_y);
          cursor_y += 12;
        }
        if (card.description) {
          pdf.setFont('helvetica', 'italic');
          pdf.text(`Description: ${card.description}`, card_x, cursor_y);
          cursor_y += 12;
        }
        cursor_y += 4;
        break;
      }

      default: {
        if (card.content) {
          ensure_space(16);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(51, 65, 85);
          const gen_lines = pdf.splitTextToSize(card.content, card_w);
          gen_lines.forEach((gl) => {
            ensure_space(12);
            pdf.text(gl, card_x, cursor_y);
            cursor_y += 12;
          });
          cursor_y += 4;
        }
        break;
      }
    }

    // Render Discussion Comments Thread for this card if present
    const comments = cardCommentsSignal.value?.[card.id] || [];
    if (comments.length > 0) {
      ensure_space(28);
      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      const comments_box_y = cursor_y;

      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(71, 85, 105);
      pdf.text(`💬 Team Discussion Thread (${comments.length} comment${comments.length > 1 ? 's' : ''}):`, card_x + 4, cursor_y);
      cursor_y += 13;

      comments.forEach((cm) => {
        ensure_space(22);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        const commenter_name = cm.user_name || 'Collaborator';
        const role_str = cm.role ? ` (${cm.role})` : '';
        const time_str = cm.timestamp ? new Date(cm.timestamp).toLocaleDateString() : '';
        pdf.text(`${commenter_name}${role_str} · ${time_str}`, card_x + 10, cursor_y);
        cursor_y += 11;

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(71, 85, 105);
        const cm_lines = pdf.splitTextToSize(cm.text || cm.content || '', card_w - 24);
        cm_lines.forEach((cml) => {
          ensure_space(11);
          pdf.text(cml, card_x + 10, cursor_y);
          cursor_y += 11;
        });

        // Any replies
        if (Array.isArray(cm.replies) && cm.replies.length > 0) {
          cm.replies.forEach((rep) => {
            ensure_space(12);
            pdf.setFontSize(7.5);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(100, 116, 139);
            pdf.text(`↳ ${rep.user_name}: ${rep.text}`, card_x + 18, cursor_y);
            cursor_y += 11;
          });
        }
        cursor_y += 4;
      });
      cursor_y += 4;
    }

    // Divider line between cards
    ensure_space(12);
    pdf.setDrawColor(241, 245, 249);
    pdf.setLineWidth(0.5);
    pdf.line(card_x, cursor_y, margin_x + content_w, cursor_y);
    cursor_y += 14;
  };

  // Render Groups First
  groups.forEach((group) => {
    ensure_space(50);

    // Group Container Banner
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(203, 213, 225);
    pdf.roundedRect(margin_x, cursor_y, content_w, 36, 4, 4, 'FD');

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`📂 GROUP CONTAINER: ${group.title || 'Untitled Group'}`, margin_x + 12, cursor_y + 16);

    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 116, 139);
    pdf.text(group.description || 'Structured spatial group container', margin_x + 12, cursor_y + 28);
    cursor_y += 46;

    // Member Cards inside group
    const member_cards = (group.card_ids || [])
      .map((id) => cards.find((c) => c.id === id))
      .filter(Boolean);

    member_cards.forEach((member) => {
      render_card_pdf_detail(member, 14);
    });

    cursor_y += 10;
  });

  // Render Ungrouped Cards
  const ungrouped_cards = cards
    .filter((c) => c.type !== 'group' && !grouped_card_ids.has(c.id))
    .sort((a, b) => (a.y === b.y ? (a.x || 0) - (b.x || 0) : (a.y || 0) - (b.y || 0)));

  if (ungrouped_cards.length > 0) {
    ensure_space(34);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text('Independent Modules & Media', margin_x, cursor_y);
    cursor_y += 16;
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin_x, cursor_y, margin_x + content_w, cursor_y);
    cursor_y += 16;

    ungrouped_cards.forEach((card) => {
      render_card_pdf_detail(card, 0);
    });
  }

  // Render Spatial Connections & Connectors Graph
  const connections = board.connections || [];
  if (connections.length > 0) {
    ensure_space(38);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.text(`Spatial Connections & Relational Graph (${connections.length} links)`, margin_x, cursor_y);
    cursor_y += 16;
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin_x, cursor_y, margin_x + content_w, cursor_y);
    cursor_y += 16;

    const cards_map = new Map();
    cards.forEach((c) => cards_map.set(c.id, c));

    connections.forEach((conn, c_idx) => {
      ensure_space(18);
      const from_card = cards_map.get(conn.fromId);
      const to_card = cards_map.get(conn.toId);
      const from_title = from_card?.title || conn.fromId;
      const to_title = to_card?.title || conn.toId;
      const style_label = conn.style === 'dashed' ? 'Dashed Relation' : 'Direct Curved Link';

      pdf.setFontSize(8.5);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(37, 99, 235);
      pdf.text(`Link ${c_idx + 1}:`, margin_x, cursor_y);

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 41, 59);
      pdf.text(`${from_title}   ──[${style_label}]──>   ${to_title}`, margin_x + 36, cursor_y);
      cursor_y += 14;
    });
  }

  // Draw Page Footers on all pages
  const total_pages = pdf.getNumberOfPages();
  for (let p = 1; p <= total_pages; p++) {
    pdf.setPage(p);
    const curr_w = pdf.internal.pageSize.getWidth();
    const curr_h = pdf.internal.pageSize.getHeight();

    // Skip footer on landscape cover page if dossier
    if (is_dossier && p === 1) continue;

    pdf.setFontSize(7.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(148, 163, 184);
    pdf.text(`Lumen Spatial Workspace  ·  Exported on ${updated_date}`, margin_x, curr_h - 18);
    pdf.text(`Page ${p} of ${total_pages}`, curr_w - margin_x, curr_h - 18, { align: 'right' });
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.line(margin_x, curr_h - 26, curr_w - margin_x, curr_h - 26);
  }

  pdf.save(file_name);
  return { file_name };
};

